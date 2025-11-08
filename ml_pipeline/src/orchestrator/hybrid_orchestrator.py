import asyncio
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from src.models.foundation_forecaster import foundation_forecaster
from src.models.rl_optimizer import RLOptimizer
from src.controllers.power_flow_controller import power_controller
from src.controllers.workload_orchestrator import workload_orchestrator
from src.agents.intelligent_agent import intelligent_agent
from src.utils.logger import logger
from src.config.db import db_manager

class HybridVPPOrchestrator:
    """
    Master orchestrator that combines all intelligence layers:
    1. Foundation models for forecasting
    2. RL for real-time optimization  
    3. LLM for strategic decisions
    4. Power flow control
    5. Workload optimization
    """
    
    def __init__(self):
        self.rl_optimizer = RLOptimizer()
        self.decision_cache = {}
        self.last_strategic_decision = None
        self.last_strategic_time = None
        self.control_mode = 'autonomous'  # 'autonomous' or 'advisory'
        
    async def initialize(self):
        """Initialize all components"""
        try:
            logger.info("🚀 Initializing Hybrid VPP Orchestrator...")
            
            # Load RL model if available
            try:
                self.rl_optimizer.load("latest")
                logger.info("✅ RL model loaded")
            except FileNotFoundError:
                logger.warning("⚠️  No RL model found, will use heuristics")
            
            logger.info("✅ Hybrid Orchestrator initialized")
        except Exception as e:
            logger.error(f"Error initializing orchestrator: {e}")
            raise
    
    async def orchestrate_complete_cycle(
        self,
        node_ids: List[str],
        execute_controls: bool = True
    ) -> Dict:
        """
        Complete orchestration cycle for all nodes
        This is the main intelligence loop
        
        Args:
            node_ids: List of node IDs to manage
            execute_controls: If True, actually execute control commands
        
        Returns:
            Complete orchestration results
        """
        try:
            logger.info(f"🧠 Starting orchestration cycle for {len(node_ids)} nodes")
            start_time = datetime.now()
            
            results = {
                'timestamp': start_time,
                'nodes': {},
                'grid_actions': [],
                'workload_suggestions': [],
                'strategic_decisions': [],
                'total_revenue_potential': 0,
                'total_cost_savings': 0
            }
            
            # Get current grid state
            grid_state = await self._get_grid_state()
            
            # Check if grid needs immediate frequency support
            if await self._needs_emergency_frequency_support(grid_state):
                logger.warning("🚨 Emergency frequency support triggered!")
                emergency_actions = await power_controller.regulate_grid_frequency(
                    current_frequency=grid_state['frequency'],
                    available_nodes=node_ids
                )
                results['grid_actions'].extend(emergency_actions)
            
            # Process each node
            for node_id in node_ids:
                node_result = await self._orchestrate_single_node(
                    node_id,
                    grid_state,
                    execute_controls
                )
                results['nodes'][node_id] = node_result
                
                # Accumulate totals
                results['total_revenue_potential'] += node_result.get('revenue_potential', 0)
                results['total_cost_savings'] += node_result.get('cost_savings', 0)
            
            # Generate portfolio-level insights
            results['portfolio_insights'] = await self._generate_portfolio_insights(results)
            
            # Log execution time
            execution_time = (datetime.now() - start_time).total_seconds()
            results['execution_time_seconds'] = execution_time
            
            logger.info(
                f"✅ Orchestration cycle complete: {execution_time:.2f}s | "
                f"Revenue potential: ₹{results['total_revenue_potential']:.2f} | "
                f"Cost savings: ₹{results['total_cost_savings']:.2f}"
            )
            
            return results
        
        except Exception as e:
            logger.error(f"Error in orchestration cycle: {e}")
            raise
    
    async def _orchestrate_single_node(
        self,
        node_id: str,
        grid_state: Dict,
        execute_controls: bool
    ) -> Dict:
        """
        Complete orchestration for a single node
        """
        try:
            node_result = {
                'node_id': node_id,
                'timestamp': datetime.now(),
                'forecasts': {},
                'optimizations': {},
                'controls': [],
                'workload_suggestions': [],
                'strategic_decision': None,
                'revenue_potential': 0,
                'cost_savings': 0
            }
            
            # 1. Get current node state
            node_state = await self._get_node_state(node_id)
            
            if not node_state:
                logger.warning(f"No state data for {node_id}")
                return node_result
            
            # 2. Generate forecasts (Layer 1: Foundation Model)
            forecasts = await self._generate_forecasts(node_id, node_state)
            node_result['forecasts'] = forecasts
            
            # 3. Make strategic decision (Layer 3: LLM Agent)
            strategic_decision = await self._make_strategic_decision(
                node_id,
                node_state,
                grid_state,
                forecasts
            )
            node_result['strategic_decision'] = strategic_decision
            
            # If strategy says don't participate, skip optimization
            if not strategic_decision.get('should_participate', True):
                logger.info(f"⏸️  {node_id}: Strategic decision is to not participate")
                node_result['explanation'] = strategic_decision.get('reasoning')
                return node_result
            
            # 4. Optimize with RL (Layer 2: Real-time Optimization)
            rl_optimization = await self._optimize_with_rl(
                node_id,
                node_state,
                forecasts
            )
            node_result['optimizations'] = rl_optimization
            
            # 5. Workload optimization suggestions
            workload_suggestions = await self._optimize_workloads(
                node_id,
                forecasts,
                node_state
            )
            node_result['workload_suggestions'] = workload_suggestions
            node_result['cost_savings'] = sum(
                s.get('potential_savings', 0) for s in workload_suggestions
            )
            
            # 6. Execute control commands (if enabled)
            if execute_controls and self.control_mode == 'autonomous':
                controls = await self._execute_controls(
                    node_id,
                    rl_optimization,
                    strategic_decision
                )
                node_result['controls'] = controls
            
            # 7. Calculate revenue potential
            node_result['revenue_potential'] = self._calculate_revenue_potential(
                rl_optimization,
                forecasts
            )
            
            # 8. Generate explanation
            node_result['explanation'] = await intelligent_agent.explain_decision(
                decision={
                    'action': rl_optimization.get('action'),
                    'reason': strategic_decision.get('reasoning')
                },
                context={
                    'node_state': node_state,
                    'grid_state': grid_state,
                    'forecasts': forecasts
                }
            )
            
            return node_result
        
        except Exception as e:
            logger.error(f"Error orchestrating node {node_id}: {e}")
            return {
                'node_id': node_id,
                'error': str(e),
                'timestamp': datetime.now()
            }
    
    async def _get_grid_state(self) -> Dict:
        """Get current grid state"""
        try:
            # In production, this would fetch from POSOCO/SCADA
            # For now, simulate based on time of day
            current_hour = datetime.now().hour
            
            # Simulate grid frequency (49.5-50.5 Hz)
            base_frequency = 50.0
            if 18 <= current_hour <= 22:  # Peak hours - lower frequency
                frequency = base_frequency - np.random.uniform(0.05, 0.15)
            elif 2 <= current_hour <= 5:  # Night - higher frequency
                frequency = base_frequency + np.random.uniform(0.0, 0.1)
            else:
                frequency = base_frequency + np.random.uniform(-0.05, 0.05)
            
            return {
                'frequency': frequency,
                'timestamp': datetime.now(),
                'demand': np.random.uniform(80000, 120000),  # MW (simulated national demand)
                'renewable_generation': np.random.uniform(20000, 40000)  # MW
            }
        except Exception as e:
            logger.error(f"Error getting grid state: {e}")
            return {'frequency': 50.0, 'timestamp': datetime.now()}
    
    async def _get_node_state(self, node_id: str) -> Optional[Dict]:
        """Get current state of a node with proper error handling"""
        try:
            collection = db_manager.mongo_db['telemetries']
            
            # Get latest record with valid batteryLevel
            latest = await collection.find_one(
                {
                    'nodeId': node_id,
                    'batteryLevel': {'$gt': 0}  # Ensure non-zero SOC
                },
                sort=[('timestamp', -1)]
            )
            
            if not latest:
                logger.warning(f"No valid telemetry for {node_id}, trying without SOC filter")
                # Fallback to any latest record
                latest = await collection.find_one(
                    {'nodeId': node_id},
                    sort=[('timestamp', -1)]
                )
            
            if not latest:
                logger.error(f"No telemetry data at all for {node_id}")
                return None
            
            # Extract with proper defaults
            soc = latest.get('batteryLevel', 50.0)  # Default to 50% if missing
            if soc <= 0 or soc > 100:
                logger.warning(f"Invalid SOC {soc}% for {node_id}, using 50%")
                soc = 50.0
            
            state = {
                'soc': float(soc),
                'power_output': float(latest.get('powerOutput', 0)),
                'voltage': float(latest.get('voltage', 400)),
                'current': float(latest.get('current', 0)),
                'frequency': float(latest.get('frequency', 50)),
                'temperature': float(latest.get('temperature', 25)),
                'grid_frequency': float(latest.get('gridMetrics', {}).get('gridFrequency', 50)),
                'timestamp': latest.get('timestamp', datetime.now())
            }
            
            logger.info(f"Node state: {node_id} - SOC: {state['soc']}%, Power: {state['power_output']} kW")
            return state
        
        except Exception as e:
            logger.error(f"Error getting node state: {e}")
            return None
    
    async def _needs_emergency_frequency_support(self, grid_state: Dict) -> bool:
        """Check if grid needs emergency frequency support"""
        frequency = grid_state.get('frequency', 50.0)
        return frequency < 49.7 or frequency > 50.3
    
    async def _generate_forecasts(
        self,
        node_id: str,
        node_state: Dict
    ) -> Dict:
        """Generate forecasts with realistic prices"""
        try:
            # Fetch historical data
            collection = db_manager.mongo_db['telemetries']
            cursor = collection.find(
                {'nodeId': node_id}
            ).sort('timestamp', -1).limit(168)
            
            historical_data = await cursor.to_list(length=168)
            
            if len(historical_data) < 48:  # Need minimum 48 hours for Prophet
                logger.warning(f"Only {len(historical_data)} records, need 48+")
                return {'status': 'insufficient_data'}
            
            # Extract power values and timestamps
            power_values = np.array([
                d.get('powerOutput', 0) for d in reversed(historical_data)
            ])
            timestamps = pd.DatetimeIndex([
                d.get('timestamp') for d in reversed(historical_data)
            ])
            
            # Generate power forecast
            power_forecast, power_lower, power_upper = foundation_forecaster.predict_with_fine_tuning(
                node_id=node_id,
                historical_data=power_values,
                prediction_length=6,
                timestamps=timestamps
            )
            
            # Generate REALISTIC price forecast based on time of day
            current_time = datetime.now()
            price_forecast = []
            
            for i in range(6):
                future_time = current_time + timedelta(hours=i)
                hour = future_time.hour
                
                # Indian electricity market price patterns
                if 18 <= hour <= 22:  # Peak evening (6 PM - 10 PM)
                    base_price = 180
                    variation = np.random.uniform(-20, 30)
                elif 10 <= hour <= 17:  # Day time
                    base_price = 130
                    variation = np.random.uniform(-15, 20)
                elif 6 <= hour <= 9:  # Morning peak
                    base_price = 150
                    variation = np.random.uniform(-10, 25)
                else:  # Off-peak (night)
                    base_price = 70
                    variation = np.random.uniform(-10, 15)
                
                price = base_price + variation
                price_forecast.append(price)
            
            logger.info(f"Price forecast for next 6h: {[f'{p:.0f}' for p in price_forecast]} ₹/kWh")
            
            return {
                'power': {
                    'forecast': power_forecast.tolist(),
                    'lower_bound': power_lower.tolist(),
                    'upper_bound': power_upper.tolist()
                },
                'price': {
                    'forecast': price_forecast,
                    'current': price_forecast[0],
                    'peak': max(price_forecast),
                    'off_peak': min(price_forecast)
                },
                'horizon_hours': 6,
                'generated_at': datetime.now()
            }
        
        except Exception as e:
            logger.error(f"Error generating forecasts: {e}")
            return {'status': 'error', 'error': str(e)}
    
    async def _make_strategic_decision(
        self,
        node_id: str,
        node_state: Dict,
        grid_state: Dict,
        forecasts: Dict
    ) -> Dict:
        """Make strategic decision using LLM agent"""
        try:
            # Only make strategic decisions every hour (not every cycle)
            current_hour = datetime.now().hour
            
            if self.last_strategic_time and self.last_strategic_time == current_hour:
                # Use cached decision
                return self.last_strategic_decision or {'should_participate': True}
            
            # Get market data
            avg_forecasted_price = np.mean(forecasts.get('price', {}).get('forecast', [100]))
            
            market_data = {
                'clearing_price': avg_forecasted_price,
                'forecast': forecasts.get('price', {}).get('forecast', []),
                'type': 'ancillary_services'
            }
            
            # Make strategic assessment
            assessment = await intelligent_agent.assess_market_opportunity(
                market_data=market_data,
                node_status=node_state,
                forecasts=forecasts
            )
            
            # Cache decision
            self.last_strategic_decision = assessment
            self.last_strategic_time = current_hour
            
            return assessment
        
        except Exception as e:
            logger.error(f"Error making strategic decision: {e}")
            return {'should_participate': True, 'reasoning': 'Default to participation'}
    
    async def _optimize_with_rl(
        self,
        node_id: str,
        node_state: Dict,
        forecasts: Dict
    ) -> Dict:
        """Optimize using RL model"""
        try:
            # Prepare state for RL
            rl_state = np.array([
                node_state.get('soc', 50),
                node_state.get('grid_frequency', 50),
                np.mean(forecasts.get('price', {}).get('forecast', [100])),
                node_state.get('power_output', 0),
                datetime.now().hour,
                datetime.now().weekday()
            ], dtype=np.float32)
            
            # Get action from RL model
            try:
                action_id, _ = self.rl_optimizer.predict(rl_state, deterministic=True)
            except:
                # Fallback to heuristic if RL model not available
                action_id = self._heuristic_action(node_state, forecasts)
            
            # Map action
            action_map = {
                0: {'action': 'hold', 'magnitude': 0},
                1: {'action': 'charge', 'magnitude': 150},
                2: {'action': 'discharge', 'magnitude': 200},
                3: {'action': 'bid_high', 'magnitude': 1.2},
                4: {'action': 'bid_low', 'magnitude': 0.8}
            }
            
            optimization = action_map.get(int(action_id), {'action': 'hold', 'magnitude': 0})
            optimization['confidence'] = 0.8
            optimization['source'] = 'rl_model'
            
            return optimization
        
        except Exception as e:
            logger.error(f"Error in RL optimization: {e}")
            return {'action': 'hold', 'magnitude': 0, 'source': 'error_fallback'}
    
    def _heuristic_action(self, node_state: Dict, forecasts: Dict) -> int:
        """Fallback heuristic when RL unavailable"""
        soc = node_state.get('soc', 50)
        grid_freq = node_state.get('grid_frequency', 50)
        avg_price = np.mean(forecasts.get('price', {}).get('forecast', [100]))
        
        # Simple rules
        if grid_freq < 49.9 and soc > 30:
            return 2  # Discharge to support frequency
        elif avg_price > 150 and soc > 40:
            return 2  # Discharge at high prices
        elif avg_price < 80 and soc < 70:
            return 1  # Charge at low prices
        else:
            return 0  # Hold
    
    async def _optimize_workloads(
        self,
        node_id: str,
        forecasts: Dict,
        node_state: Dict
    ) -> List[Dict]:
        """Generate workload optimization suggestions"""
        try:
            # Get current workloads (in production, fetch from data center API)
            current_workloads = await self._get_current_workloads(node_id)
            
            if not current_workloads:
                return []
            
            # Get price forecast
            price_forecast = forecasts.get('price', {}).get('forecast', [])
            current_price = price_forecast[0] if price_forecast else 100
            
            # Generate suggestions
            suggestions = await workload_orchestrator.suggest_workload_deferrals(
                node_id=node_id,
                current_price=current_price,
                forecasted_prices=price_forecast,
                current_workloads=current_workloads
            )
            
            return suggestions
        
        except Exception as e:
            logger.error(f"Error optimizing workloads: {e}")
            return []
    
    async def _get_current_workloads(self, node_id: str) -> List[Dict]:
        """Get current workloads running on node"""
        # In production, this would query the data center management system
        # For now, simulate some workloads
        return [
            {
                'id': f'workload_{node_id}_1',
                'type': 'ml_training',
                'power_kw': 100,
                'priority': 'medium'
            },
            {
                'id': f'workload_{node_id}_2',
                'type': 'batch_processing',
                'power_kw': 80,
                'priority': 'low'
            }
        ]
    
    async def _execute_controls(
        self,
        node_id: str,
        optimization: Dict,
        strategic_decision: Dict
    ) -> List[Dict]:
        """Execute control commands"""
        controls = []
        
        try:
            action = optimization.get('action')
            magnitude = optimization.get('magnitude', 0)
            
            if action in ['charge', 'discharge'] and magnitude > 0:
                # Execute power control
                result = await power_controller.control_node_power(
                    node_id=node_id,
                    action=action,
                    magnitude=magnitude,
                    reason=f"Optimized action: {strategic_decision.get('reasoning', 'optimization')}",
                    duration_minutes=15
                )
                controls.append(result)
            
            return controls
        
        except Exception as e:
            logger.error(f"Error executing controls: {e}")
            return []
    
    def _calculate_revenue_potential(
        self,
        optimization: Dict,
        forecasts: Dict
    ) -> float:
        """Calculate realistic revenue potential"""
        try:
            action = optimization.get('action')
            magnitude = optimization.get('magnitude', 0)
            
            if action is None or magnitude == 0:
                return 0.0
            
            # Get price forecast
            price_forecast = forecasts.get('price', {}).get('forecast', [100])
            current_price = price_forecast[0] if price_forecast else 100
            
            # Calculate based on action
            if action == 'Discharge':
                # Revenue = Power (kW) × Duration (h) × Price (₹/kWh)
                duration_hours = 0.25  # 15 minutes
                revenue = magnitude * duration_hours * current_price
                
                # Subtract degradation cost (₹0.5 per kWh discharged)
                degradation_cost = magnitude * duration_hours * 0.5
                net_revenue = revenue - degradation_cost
                
                logger.info(f"Revenue calc: {magnitude}kW × {duration_hours}h × ₹{current_price}/kWh - ₹{degradation_cost:.2f} = ₹{net_revenue:.2f}")
                return max(net_revenue, 0)
            
            elif action == 'Charge':
                # Cost savings = Avoided peak price - Off-peak charging cost
                avg_peak_price = 180  # Typical peak price
                charging_cost = magnitude * 0.25 * current_price
                future_revenue = magnitude * 0.25 * avg_peak_price
                savings = future_revenue - charging_cost
                
                return max(savings * 0.5, 0)  # 50% probability of peak discharge
            
            elif action == 'Load Deferral':
                # Cost savings from shifting load to cheaper hours
                future_min_price = min(price_forecast)
                savings_per_kwh = current_price - future_min_price
                load_kwh = 100 * (magnitude / 100)  # magnitude is %
                savings = load_kwh * 0.25 * savings_per_kwh
                
                return max(savings, 0)
            
            return 0.0
        
        except Exception as e:
            logger.error(f"Error calculating revenue: {e}")
            return 0.0
    
    async def _generate_portfolio_insights(self, results: Dict) -> Dict:
        """Generate insights across all nodes"""
        try:
            # Calculate portfolio metrics
            total_nodes = len(results['nodes'])
            active_controls = sum(
                1 for node in results['nodes'].values()
                if node.get('controls')
            )
            
            insights = {
                'total_nodes': total_nodes,
                'active_controls': active_controls,
                'total_revenue_potential': results['total_revenue_potential'],
                'total_cost_savings': results['total_cost_savings'],
                'avg_revenue_per_node': results['total_revenue_potential'] / total_nodes if total_nodes > 0 else 0,
                'recommendations': []
            }
            
            # Generate recommendations using LLM
            if total_nodes > 0:
                daily_metrics = {
                    'nodes': total_nodes,
                    'revenue_potential': results['total_revenue_potential'],
                    'cost_savings': results['total_cost_savings']
                }
                
                summary = await intelligent_agent.generate_daily_report(daily_metrics)
                insights['summary'] = summary
            
            return insights
        
        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            return {}
    
    async def explain_system_behavior(
        self,
        node_id: str,
        time_window_hours: int = 24
    ) -> str:
        """Generate explanation of system behavior over time"""
        try:
            # Fetch recent decisions
            collection = db_manager.mongo_db['control_logs']
            cursor = collection.find(
                {
                    'node_id': node_id,
                    'timestamp': {
                        '$gte': datetime.now() - timedelta(hours=time_window_hours)
                    }
                }
            ).sort('timestamp', -1).limit(20)
            
            decisions = await cursor.to_list(length=20)
            
            # Generate explanation
            explanation = await intelligent_agent.explain_decision(
                decision={'recent_actions': decisions},
                context={'time_window': f'{time_window_hours} hours'}
            )
            
            return explanation
        
        except Exception as e:
            logger.error(f"Error explaining behavior: {e}")
            return "Unable to generate explanation at this time."
        
    
    async def _optimize_with_rl(
        self,
        node_id: str,
        node_state: Dict,
        forecasts: Dict
    ) -> Dict:
        """Optimize using RL model"""
        try:
            # Prepare state for RL
            rl_state = np.array([
                node_state.get('soc', 50),
                node_state.get('grid_frequency', 50),
                np.mean(forecasts.get('price', {}).get('forecast', [100])),
                node_state.get('power_output', 0),
                datetime.now().hour,
                datetime.now().weekday()
            ], dtype=np.float32)
            
            # Get action from RL model
            try:
                action_id, _ = self.rl_optimizer.predict(rl_state, deterministic=True)
            except:
                action_id = self._heuristic_action(node_state, forecasts)
            
            # Map action to hardware commands
            action_map = {
                0: {'action': 'Hold', 'magnitude': 0},
                1: {'action': 'Charge', 'magnitude': 150},
                2: {'action': 'Discharge', 'magnitude': 200},
                3: {'action': 'Discharge', 'magnitude': 250},  # High discharge
                4: {'action': 'Load Deferral', 'magnitude': 30}  # Defer 30% of load
            }
            
            optimization = action_map.get(int(action_id), {'action': 'Hold', 'magnitude': 0})
            optimization['confidence'] = 0.8
            optimization['source'] = 'rl_model'
            optimization['action_id'] = int(action_id)
            
            logger.info(f"RL optimization for {node_id}: {optimization['action']} ({optimization['magnitude']})")
            
            return optimization
        
        except Exception as e:
            logger.error(f"Error in RL optimization: {e}")
            return {'action': 'Hold', 'magnitude': 0, 'source': 'error_fallback'}

    def _heuristic_action(self, node_state: Dict, forecasts: Dict) -> int:
        """Fallback heuristic when RL unavailable"""
        soc = node_state.get('soc', 50)
        grid_freq = node_state.get('grid_frequency', 50)
        avg_price = np.mean(forecasts.get('price', {}).get('forecast', [100]))
        current_hour = datetime.now().hour
        
        # Peak hours + high price + good SOC = Discharge
        if 18 <= current_hour <= 22 and avg_price > 150 and soc > 50:
            return 2  # Discharge
        
        # Low frequency + good SOC = Discharge (frequency support)
        elif grid_freq < 49.9 and soc > 30:
            return 2  # Discharge
        
        # High frequency + low SOC = Charge
        elif grid_freq > 50.1 and soc < 70:
            return 1  # Charge
        
        # Low price + low SOC = Charge
        elif avg_price < 80 and soc < 60:
            return 1  # Charge
        
        # Very high load + high price = Load Deferral
        elif avg_price > 180 and current_hour in [18, 19, 20]:
            return 4  # Load Deferral
        
        else:
            return 0  # Hold

# Global orchestrator
hybrid_orchestrator = HybridVPPOrchestrator()