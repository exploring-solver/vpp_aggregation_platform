import numpy as np
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
from src.utils.logger import logger
from src.models.foundation_forecaster import foundation_forecaster
from src.config.db import db_manager

class WorkloadOrchestrator:
    """
    Intelligent workload management that learns data center usage patterns
    Suggests when to defer/shift workloads to optimize costs
    """
    
    def __init__(self):
        self.learned_patterns = {}  # node_id -> usage patterns
        self.workload_types = {
            'batch_processing': {'deferrable': True, 'max_delay_hours': 8},
            'ml_training': {'deferrable': True, 'max_delay_hours': 12},
            'data_backup': {'deferrable': True, 'max_delay_hours': 24},
            'real_time': {'deferrable': False, 'max_delay_hours': 0},
            'web_serving': {'deferrable': False, 'max_delay_hours': 0}
        }
    
    async def learn_usage_patterns(self, node_id: str, days: int = 30):
        """
        Learn data center usage patterns from historical data
        """
        try:
            logger.info(f"Learning usage patterns for {node_id}...")
            
            # Fetch historical load data
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            collection = db_manager.mongo_db['telemetries']
            cursor = collection.find({
                'nodeId': node_id,
                'timestamp': {'$gte': start_date, '$lte': end_date}
            }).sort('timestamp', 1)
            
            data = await cursor.to_list(length=10000)
            
            if len(data) < 100:
                logger.warning(f"Insufficient data to learn patterns for {node_id}")
                return None
            
            # Extract power consumption by hour of day
            hourly_consumption = {hour: [] for hour in range(24)}
            daily_consumption = {day: [] for day in range(7)}  # Day of week
            
            for record in data:
                timestamp = record['timestamp']
                power = record.get('powerOutput', 0)
                
                hour = timestamp.hour
                day_of_week = timestamp.weekday()
                
                hourly_consumption[hour].append(power)
                daily_consumption[day_of_week].append(power)
            
            # Calculate patterns
            patterns = {
                'hourly_avg': {
                    hour: np.mean(values) if values else 0
                    for hour, values in hourly_consumption.items()
                },
                'hourly_std': {
                    hour: np.std(values) if values else 0
                    for hour, values in hourly_consumption.items()
                },
                'daily_avg': {
                    day: np.mean(values) if values else 0
                    for day, values in daily_consumption.items()
                },
                'peak_hours': self._identify_peak_hours(hourly_consumption),
                'off_peak_hours': self._identify_off_peak_hours(hourly_consumption),
                'learned_at': datetime.now()
            }
            
            self.learned_patterns[node_id] = patterns
            
            logger.info(f"✅ Learned patterns for {node_id}")
            logger.info(f"Peak hours: {patterns['peak_hours']}")
            logger.info(f"Off-peak hours: {patterns['off_peak_hours']}")
            
            return patterns
        
        except Exception as e:
            logger.error(f"Error learning patterns: {e}")
            return None
    
    def _identify_peak_hours(self, hourly_data: Dict) -> List[int]:
        """Identify peak consumption hours"""
        hourly_avg = {h: np.mean(v) if v else 0 for h, v in hourly_data.items()}
        threshold = np.mean(list(hourly_avg.values())) * 1.2  # 20% above average
        peak_hours = [h for h, avg in hourly_avg.items() if avg > threshold]
        return sorted(peak_hours)
    
    def _identify_off_peak_hours(self, hourly_data: Dict) -> List[int]:
        """Identify off-peak consumption hours"""
        hourly_avg = {h: np.mean(v) if v else 0 for h, v in hourly_data.items()}
        threshold = np.mean(list(hourly_avg.values())) * 0.8  # 20% below average
        off_peak_hours = [h for h, avg in hourly_avg.items() if avg < threshold]
        return sorted(off_peak_hours)
    
    async def suggest_workload_deferrals(
        self,
        node_id: str,
        current_price: float,
        forecasted_prices: List[float],
        current_workloads: List[Dict]
    ) -> List[Dict]:
        """
        Suggest which workloads should be deferred to save costs
        
        Returns:
            List of suggestions with reasoning
        """
        suggestions = []
        
        try:
            # Ensure patterns are learned
            if node_id not in self.learned_patterns:
                await self.learn_usage_patterns(node_id)
            
            patterns = self.learned_patterns.get(node_id, {})
            current_hour = datetime.now().hour
            
            # Check if we're in peak pricing period
            is_peak_price = current_price > np.mean(forecasted_prices) * 1.15
            
            # Check if we're in peak usage period
            peak_hours = patterns.get('peak_hours', [])
            is_peak_usage = current_hour in peak_hours
            
            for workload in current_workloads:
                workload_type = workload.get('type', 'batch_processing')
                workload_power = workload.get('power_kw', 100)
                workload_id = workload.get('id', 'unknown')
                
                # Get deferability
                type_config = self.workload_types.get(
                    workload_type,
                    {'deferrable': True, 'max_delay_hours': 8}
                )
                
                if not type_config['deferrable']:
                    continue  # Can't defer this workload
                
                # Calculate potential savings
                min_future_price_idx = np.argmin(forecasted_prices[:type_config['max_delay_hours']])
                min_future_price = forecasted_prices[min_future_price_idx]
                
                potential_savings = (current_price - min_future_price) * workload_power
                
                # Suggest deferral if significant savings
                if potential_savings > 50:  # ₹50 threshold
                    suggestion = {
                        'workload_id': workload_id,
                        'workload_type': workload_type,
                        'action': 'defer',
                        'defer_hours': min_future_price_idx + 1,
                        'current_price': current_price,
                        'future_price': min_future_price,
                        'potential_savings': potential_savings,
                        'reason': self._generate_deferral_reason(
                            is_peak_price,
                            is_peak_usage,
                            potential_savings
                        ),
                        'priority': 'high' if potential_savings > 200 else 'medium'
                    }
                    suggestions.append(suggestion)
            
            logger.info(f"Generated {len(suggestions)} workload deferral suggestions for {node_id}")
            return suggestions
        
        except Exception as e:
            logger.error(f"Error generating workload suggestions: {e}")
            return []
    
    def _generate_deferral_reason(
        self,
        is_peak_price: bool,
        is_peak_usage: bool,
        savings: float
    ) -> str:
        """Generate human-readable reason for deferral"""
        reasons = []
        
        if is_peak_price:
            reasons.append("electricity prices are at peak")
        if is_peak_usage:
            reasons.append("data center usage is at peak")
        
        reason_text = " and ".join(reasons) if reasons else "better pricing available later"
        
        return f"Defer this workload because {reason_text}. Potential savings: ₹{savings:.2f}"
    
    async def optimize_workload_schedule(
        self,
        node_id: str,
        workloads: List[Dict],
        time_horizon_hours: int = 24
    ) -> Dict:
        """
        Optimize entire workload schedule for next N hours
        Returns optimized schedule with cost breakdown
        """
        try:
            # Get price forecast
            historical_prices = await self._get_historical_prices(node_id, hours=48)
            forecasted_prices, _, _ = foundation_forecaster.predict_zero_shot(
                historical_prices,
                prediction_length=time_horizon_hours
            )
            
            # Create time slots
            schedule = []
            current_time = datetime.now()
            
            for hour in range(time_horizon_hours):
                time_slot = current_time + timedelta(hours=hour)
                price = forecasted_prices[hour]
                
                # Assign workloads to slots based on priority and cost
                slot_workloads = []
                
                for workload in workloads:
                    if workload.get('scheduled', False):
                        continue  # Already scheduled
                    
                    workload_type = workload.get('type', 'batch_processing')
                    type_config = self.workload_types.get(workload_type, {})
                    
                    # Check if this slot is suitable
                    if not type_config.get('deferrable', True):
                        # Must run immediately
                        if hour == 0:
                            slot_workloads.append(workload)
                            workload['scheduled'] = True
                    else:
                        # Can be scheduled flexibly - choose cheapest slot
                        max_delay = type_config.get('max_delay_hours', 8)
                        if hour < max_delay and price < np.mean(forecasted_prices[:max_delay]):
                            slot_workloads.append(workload)
                            workload['scheduled'] = True
                
                schedule.append({
                    'time': time_slot,
                    'hour': hour,
                    'price': float(price),
                    'workloads': slot_workloads,
                    'total_power': sum(w.get('power_kw', 0) for w in slot_workloads),
                    'estimated_cost': sum(w.get('power_kw', 0) * price for w in slot_workloads)
                })
            
            # Calculate total cost
            total_cost = sum(slot['estimated_cost'] for slot in schedule)
            
            # Calculate baseline cost (if all workloads ran now)
            baseline_cost = sum(
                w.get('power_kw', 0) * forecasted_prices[0]
                for w in workloads
            )
            
            savings = baseline_cost - total_cost
            
            result = {
                'node_id': node_id,
                'schedule': schedule,
                'total_cost': float(total_cost),
                'baseline_cost': float(baseline_cost),
                'savings': float(savings),
                'savings_percentage': float((savings / baseline_cost * 100) if baseline_cost > 0 else 0),
                'optimized_at': datetime.now()
            }
            
            logger.info(
                f"✅ Optimized schedule for {node_id}: "
                f"₹{total_cost:.2f} vs baseline ₹{baseline_cost:.2f} "
                f"(saving ₹{savings:.2f}, {result['savings_percentage']:.1f}%)"
            )
            
            return result
        
        except Exception as e:
            logger.error(f"Error optimizing schedule: {e}")
            return {}
    
    async def _get_historical_prices(self, node_id: str, hours: int = 48) -> np.ndarray:
        """Fetch historical electricity prices"""
        try:
            # In production, fetch from transactions or market data
            # For now, simulate based on time of day patterns
            current_hour = datetime.now().hour
            prices = []
            
            for i in range(hours):
                hour = (current_hour - hours + i) % 24
                # Simulate price pattern
                if 18 <= hour <= 22:  # Peak evening
                    price = np.random.uniform(150, 200)
                elif 9 <= hour <= 17:  # Daytime
                    price = np.random.uniform(100, 150)
                else:  # Off-peak
                    price = np.random.uniform(60, 100)
                prices.append(price)
            
            return np.array(prices)
        except Exception as e:
            logger.error(f"Error fetching prices: {e}")
            return np.array([100] * hours)

# Global orchestrator
workload_orchestrator = WorkloadOrchestrator()