"""
Intelligent strategy agent using LLM for high-level decisions
"""
from typing import Dict, List, Optional
from datetime import datetime
from src.utils.logger import logger
from src.config.config import config
import json

# Make OpenAI optional
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

class IntelligentStrategyAgent:
    """
    LLM-powered agent for high-level strategic decisions and explanations
    Falls back to rule-based logic if OpenAI unavailable
    """
    
    def __init__(self):
        self.client = None
        self.llm_enabled = False
        
        # Try to initialize OpenAI
        if OPENAI_AVAILABLE and config.OPENAI_API_KEY:
            try:
                self.client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
                self.llm_enabled = True
                logger.info("✅ LLM agent enabled (OpenAI)")
            except Exception as e:
                logger.warning(f"⚠️  Could not initialize OpenAI: {e}")
                self.llm_enabled = False
        else:
            logger.info("📋 LLM agent using rule-based fallback (no OpenAI API key)")
        
        self.system_prompt = """
You are an expert AI agent managing a Virtual Power Plant (VPP) for data centers in India.
Your responsibilities include making strategic decisions, explaining system behavior, 
and suggesting optimizations. Always be concise and actionable.
"""
    
    async def explain_decision(
        self,
        decision: Dict,
        context: Dict
    ) -> str:
        """
        Explain why a particular decision was made
        """
        if self.llm_enabled:
            try:
                prompt = f"""
Decision: {json.dumps(decision, default=str)}
Context: {json.dumps(context, default=str)}

Explain this decision in 2-3 sentences for a data center operator.
"""
                
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.5,
                    max_tokens=150
                )
                
                return response.choices[0].message.content
            except Exception as e:
                logger.error(f"Error generating explanation: {e}")
                return self._fallback_explanation(decision, context)
        else:
            return self._fallback_explanation(decision, context)
    
    def _fallback_explanation(self, decision: Dict, context: Dict) -> str:
        """Rule-based explanation when LLM unavailable"""
        action = decision.get('action', 'unknown')
        reason = decision.get('reason', 'optimization')
        
        explanations = {
            'Charge': f"Charging battery because {reason}. This stores energy for later use.",
            'Discharge': f"Discharging battery because {reason}. This generates revenue.",
            'Hold': f"Holding current state because {reason}. Waiting for better conditions.",
            'Load Deferral': f"Deferring workload because {reason}. This reduces costs."
        }
        
        return explanations.get(action, f"Action: {action}. Reason: {reason}.")
    
    async def assess_market_opportunity(
        self,
        market_data: Dict,
        node_status: Dict,
        forecasts: Dict
    ) -> Dict:
        """
        Assess whether to participate in market
        """
        if self.llm_enabled:
            try:
                prompt = f"""
Market: Price={market_data.get('clearing_price', 0)}/kWh
Status: SOC={node_status.get('soc', 0)}%, Available={node_status.get('available_capacity', 0)}kW
Forecast: {market_data.get('forecast', [])}

Should we participate? Respond as JSON:
{{"should_participate": true/false, "confidence": 0-1, "reasoning": "brief"}}
"""
                
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                    max_tokens=200
                )
                
                assessment = json.loads(response.choices[0].message.content)
                assessment['generated_at'] = datetime.now().isoformat()
                assessment['method'] = 'llm'
                
                return assessment
            except Exception as e:
                logger.error(f"Error in market assessment: {e}")
                return self._fallback_market_assessment(market_data, node_status)
        else:
            return self._fallback_market_assessment(market_data, node_status)
    
    def _fallback_market_assessment(self, market_data: Dict, node_status: Dict) -> Dict:
        """Smart rule-based market assessment"""
        price = market_data.get('clearing_price', 100)
        soc = node_status.get('soc', 50)
        available_capacity = node_status.get('available_capacity', 200)
        
        # Calculate average and peak prices
        forecast = market_data.get('forecast', [100])
        avg_price = sum(forecast) / len(forecast)
        peak_price = max(forecast)
        
        # Decision matrix based on SOC and price
        should_participate = False
        confidence = 0.5
        reasoning = ""
        recommended_bid = 0
        
        # HIGH SOC (>60%) - Ready to discharge
        if soc > 60:
            if price > 150:  # Very high price
                should_participate = True
                confidence = 0.9
                recommended_bid = min(available_capacity * 0.8, 200)  # 80% capacity
                reasoning = f"Excellent opportunity: High price (₹{price:.0f}) + High SOC ({soc:.0f}%). Discharge at 80% capacity."
            elif price > 120:  # Good price
                should_participate = True
                confidence = 0.7
                recommended_bid = min(available_capacity * 0.5, 150)  # 50% capacity
                reasoning = f"Good opportunity: Price (₹{price:.0f}) above threshold + High SOC ({soc:.0f}%). Discharge at 50% capacity."
            elif price > avg_price * 1.15:  # Above average
                should_participate = True
                confidence = 0.6
                recommended_bid = min(available_capacity * 0.3, 100)  # 30% capacity
                reasoning = f"Moderate opportunity: Price (₹{price:.0f}) above average + Good SOC ({soc:.0f}%). Conservative discharge."
        
        # MEDIUM SOC (40-60%) - Selective participation
        elif 40 <= soc <= 60:
            if price > 170:  # Only very high prices
                should_participate = True
                confidence = 0.7
                recommended_bid = min(available_capacity * 0.5, 150)
                reasoning = f"High-price opportunity: Price (₹{price:.0f}) justifies discharge at Medium SOC ({soc:.0f}%)."
            elif price > peak_price * 0.95:  # Near peak forecast
                should_participate = True
                confidence = 0.6
                recommended_bid = min(available_capacity * 0.3, 100)
                reasoning = f"Peak-price opportunity: Current price (₹{price:.0f}) near forecasted peak. Moderate discharge."
        
        # LOW SOC (<40%) - Charge if cheap, minimal discharge
        else:
            if price < 80:  # Very cheap - charge
                should_participate = True
                confidence = 0.8
                recommended_bid = -min(available_capacity * 0.6, 150)  # Negative = charge
                reasoning = f"Charging opportunity: Low price (₹{price:.0f}) + Low SOC ({soc:.0f}%). Charge at 60% capacity."
            elif price > 200:  # Emergency high price - small discharge
                should_participate = True
                confidence = 0.5
                recommended_bid = min(available_capacity * 0.2, 50)
                reasoning = f"Emergency discharge: Extremely high price (₹{price:.0f}) justifies small discharge despite Low SOC ({soc:.0f}%)."
            else:
                reasoning = f"Hold position: Price (₹{price:.0f}) not favorable for Low SOC ({soc:.0f}%). Wait for better conditions."
        
        expected_revenue = price * abs(recommended_bid) if should_participate else 0
        
        return {
            "should_participate": should_participate,
            "confidence": confidence,
            "reasoning": reasoning,
            "recommended_bid_mw": recommended_bid / 1000,  # Convert to MW
            "recommended_bid_kw": recommended_bid,
            "expected_revenue": expected_revenue,
            "risks": ["battery degradation", "price volatility"] if recommended_bid > 0 else ["opportunity cost"],
            "generated_at": datetime.now().isoformat(),
            "method": "rule_based",
            "soc": soc,
            "price": price,
            "decision_factors": {
                "soc_level": "high" if soc > 60 else "medium" if soc > 40 else "low",
                "price_level": "high" if price > 150 else "medium" if price > 100 else "low",
                "vs_average": f"{((price / avg_price - 1) * 100):.1f}%"
            }
        }
    
    async def suggest_improvements(
        self,
        performance_data: Dict,
        historical_decisions: List[Dict]
    ) -> List[str]:
        """
        Analyze performance and suggest improvements
        """
        if self.llm_enabled:
            try:
                prompt = f"""
Performance: {json.dumps(performance_data, default=str)}
Recent decisions: {len(historical_decisions)} actions

Provide 3 actionable suggestions as JSON array of strings.
"""
                
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.7,
                    max_tokens=300
                )
                
                result = json.loads(response.choices[0].message.content)
                return result.get('suggestions', [])
            except Exception as e:
                logger.error(f"Error generating suggestions: {e}")
                return self._fallback_suggestions()
        else:
            return self._fallback_suggestions()
    
    def _fallback_suggestions(self) -> List[str]:
        """Default suggestions when LLM unavailable"""
        return [
            "Monitor battery degradation trends and adjust charge/discharge cycles",
            "Analyze price patterns to optimize bidding strategy",
            "Review workload scheduling to maximize cost savings"
        ]
    
    async def generate_daily_report(self, daily_metrics: Dict) -> str:
        """
        Generate executive summary
        """
        if self.llm_enabled:
            try:
                prompt = f"""
Daily metrics: {json.dumps(daily_metrics, default=str)}

Generate a brief 2-sentence executive summary focusing on revenue and key insights.
"""
                
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.6,
                    max_tokens=150
                )
                
                return response.choices[0].message.content
            except Exception as e:
                logger.error(f"Error generating report: {e}")
                return self._fallback_report(daily_metrics)
        else:
            return self._fallback_report(daily_metrics)
    
    def _fallback_report(self, daily_metrics: Dict) -> str:
        """Simple report when LLM unavailable"""
        revenue = daily_metrics.get('total_revenue', 0)
        nodes = daily_metrics.get('nodes', 0)
        
        return f"Today's operations: ₹{revenue:.2f} revenue from {nodes} nodes. System operating normally with rule-based optimization."

# Global agent
intelligent_agent = IntelligentStrategyAgent()