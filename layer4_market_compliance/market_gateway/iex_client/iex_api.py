"""
Indian Energy Exchange (IEX) API Client
Integrates with IEX for power trading and market participation
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
import httpx

logger = logging.getLogger(__name__)


class MarketSegment(str, Enum):
    """IEX market segments"""
    DAM = "dam"              # Day-Ahead Market
    TAM = "tam"              # Term-Ahead Market
    RTM = "rtm"              # Real-Time Market
    GTM = "gtm"              # Green Term-Ahead Market
    GDAM = "gdam"            # Green Day-Ahead Market


class BidType(str, Enum):
    """Bid types"""
    BUY = "buy"
    SELL = "sell"


@dataclass
class MarketPrice:
    """Market clearing price"""
    timestamp: datetime
    segment: MarketSegment
    delivery_period: datetime
    mcp: float                # Market Clearing Price (₹/kWh)
    volume_cleared: float     # Volume cleared (MWh)
    buy_bids: int             # Number of buy bids
    sell_bids: int            # Number of sell bids


@dataclass
class Bid:
    """Market bid"""
    bid_id: str
    participant_id: str
    segment: MarketSegment
    bid_type: BidType
    delivery_period: datetime
    volume_mwh: float
    price_rs_per_kwh: float
    status: str = "pending"   # pending, accepted, rejected, partially_filled


@dataclass
class BidResult:
    """Bid execution result"""
    bid_id: str
    status: str               # accepted, rejected, partially_filled
    cleared_volume_mwh: float
    cleared_price_rs_per_kwh: float
    revenue_or_cost_rs: float


class IEXClient:
    """
    IEX API client for power trading

    Note: This is a simplified implementation.
    In production, you would use the official IEX API with proper authentication
    """

    def __init__(self, api_key: str, api_url: str = "https://api.iexindia.com"):
        """
        Initialize IEX client

        Args:
            api_key: IEX API key
            api_url: IEX API base URL
        """
        self.api_key = api_key
        self.api_url = api_url
        self.session: Optional[httpx.AsyncClient] = None

    async def connect(self):
        """Establish API session"""
        self.session = httpx.AsyncClient(
            base_url=self.api_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            timeout=30.0
        )
        logger.info("Connected to IEX API")

    async def disconnect(self):
        """Close API session"""
        if self.session:
            await self.session.aclose()
            logger.info("Disconnected from IEX API")

    async def get_market_prices(
        self,
        segment: MarketSegment,
        date: Optional[datetime] = None
    ) -> List[MarketPrice]:
        """
        Get market clearing prices

        Args:
            segment: Market segment
            date: Date for prices (default: today)

        Returns:
            List of market prices for each time block
        """
        if not self.session:
            raise ConnectionError("Not connected to IEX API")

        date = date or datetime.now()

        # In production, call real API
        # For simulation, return mock data
        return self._simulate_market_prices(segment, date)

    async def submit_bid(self, bid: Bid) -> str:
        """
        Submit a bid to the market

        Args:
            bid: Bid details

        Returns:
            Bid ID
        """
        if not self.session:
            raise ConnectionError("Not connected to IEX API")

        # In production:
        # response = await self.session.post("/bids", json=bid.dict())
        # return response.json()["bid_id"]

        # For simulation:
        logger.info(
            f"[SIMULATED] Bid submitted: {bid.bid_type.value} "
            f"{bid.volume_mwh:.2f} MWh @ ₹{bid.price_rs_per_kwh:.2f}/kWh"
        )
        return f"BID_{datetime.now().strftime('%Y%m%d%H%M%S')}"

    async def get_bid_status(self, bid_id: str) -> BidResult:
        """
        Get bid execution status

        Args:
            bid_id: Bid ID

        Returns:
            Bid result
        """
        if not self.session:
            raise ConnectionError("Not connected to IEX API")

        # In production:
        # response = await self.session.get(f"/bids/{bid_id}")
        # return BidResult(**response.json())

        # For simulation:
        return self._simulate_bid_result(bid_id)

    async def get_my_portfolio(self) -> Dict[str, Any]:
        """
        Get participant's portfolio summary

        Returns:
            Portfolio summary
        """
        if not self.session:
            raise ConnectionError("Not connected to IEX API")

        # Simulated portfolio
        return {
            "participant_id": "VPP_VUSIO",
            "pending_bids": 5,
            "cleared_bids": 120,
            "total_volume_traded_mwh": 1250.5,
            "total_revenue_rs": 5620000.0,
            "average_clearing_price": 4.49
        }

    def _simulate_market_prices(
        self,
        segment: MarketSegment,
        date: datetime
    ) -> List[MarketPrice]:
        """Simulate market clearing prices"""
        import random

        prices = []

        # Generate prices for 24 hours (for DAM) or 96 blocks (for RTM)
        num_blocks = 96 if segment == MarketSegment.RTM else 24

        for i in range(num_blocks):
            # Delivery period
            if segment == MarketSegment.RTM:
                # 15-minute blocks
                delivery_time = date + timedelta(minutes=i * 15)
            else:
                # Hourly blocks
                delivery_time = date + timedelta(hours=i)

            # Simulate price variation (₹3.5 - ₹6.5/kWh)
            # Higher prices during peak hours (10-12, 18-22)
            hour = delivery_time.hour
            if 10 <= hour <= 12 or 18 <= hour <= 22:
                base_price = 5.5
            elif 0 <= hour <= 6:
                base_price = 3.8
            else:
                base_price = 4.5

            mcp = base_price + random.uniform(-0.5, 0.5)

            prices.append(MarketPrice(
                timestamp=datetime.now(),
                segment=segment,
                delivery_period=delivery_time,
                mcp=round(mcp, 2),
                volume_cleared=random.uniform(100, 500),
                buy_bids=random.randint(20, 50),
                sell_bids=random.randint(15, 45)
            ))

        return prices

    def _simulate_bid_result(self, bid_id: str) -> BidResult:
        """Simulate bid execution result"""
        import random

        # 80% chance of acceptance
        if random.random() < 0.8:
            status = "accepted"
            cleared_volume = random.uniform(0.8, 1.0)  # 80-100% filled
        else:
            status = "rejected"
            cleared_volume = 0.0

        return BidResult(
            bid_id=bid_id,
            status=status,
            cleared_volume_mwh=cleared_volume * 10.0,  # Assuming 10 MWh bid
            cleared_price_rs_per_kwh=4.5,
            revenue_or_cost_rs=cleared_volume * 10.0 * 4.5 * 1000
        )


class BiddingStrategy:
    """
    Automated bidding strategy for VPP
    """

    def __init__(self, vpp_capacity_mw: float):
        self.vpp_capacity_mw = vpp_capacity_mw

    def calculate_optimal_bid(
        self,
        forecast_prices: List[MarketPrice],
        soc: float,
        available_energy_mwh: float
    ) -> List[Bid]:
        """
        Calculate optimal bids for next trading session

        Args:
            forecast_prices: Forecasted market prices
            soc: Current state of charge (%)
            available_energy_mwh: Available energy for discharge (MWh)

        Returns:
            List of optimal bids
        """
        bids = []

        for price_data in forecast_prices:
            # Strategy: Sell during high price hours, buy during low price hours

            if price_data.mcp > 5.0 and soc > 30:
                # High price → Sell (discharge)
                volume_mwh = min(available_energy_mwh, self.vpp_capacity_mw * 0.25)

                bid = Bid(
                    bid_id=f"SELL_{price_data.delivery_period.strftime('%Y%m%d%H%M')}",
                    participant_id="VPP_VUSIO",
                    segment=MarketSegment.DAM,
                    bid_type=BidType.SELL,
                    delivery_period=price_data.delivery_period,
                    volume_mwh=volume_mwh,
                    price_rs_per_kwh=price_data.mcp - 0.2  # Slightly below market
                )
                bids.append(bid)

            elif price_data.mcp < 4.0 and soc < 80:
                # Low price → Buy (charge)
                volume_mwh = min(
                    (100 - soc) / 100 * available_energy_mwh,
                    self.vpp_capacity_mw * 0.25
                )

                bid = Bid(
                    bid_id=f"BUY_{price_data.delivery_period.strftime('%Y%m%d%H%M')}",
                    participant_id="VPP_VUSIO",
                    segment=MarketSegment.DAM,
                    bid_type=BidType.BUY,
                    delivery_period=price_data.delivery_period,
                    volume_mwh=volume_mwh,
                    price_rs_per_kwh=price_data.mcp + 0.2  # Slightly above market
                )
                bids.append(bid)

        logger.info(f"Generated {len(bids)} bids for next trading session")
        return bids


# Simulated client for development
class SimulatedIEXClient(IEXClient):
    """Simulated IEX client for testing without real API"""

    def __init__(self):
        super().__init__(api_key="SIMULATED", api_url="http://simulated")

    async def connect(self):
        logger.info("[SIMULATED] Connected to IEX API")

    async def disconnect(self):
        logger.info("[SIMULATED] Disconnected from IEX API")

    async def get_market_prices(
        self,
        segment: MarketSegment,
        date: Optional[datetime] = None
    ) -> List[MarketPrice]:
        return self._simulate_market_prices(segment, date or datetime.now())

    async def submit_bid(self, bid: Bid) -> str:
        bid_id = f"BID_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        logger.info(
            f"[SIMULATED] Bid submitted: {bid.bid_type.value} "
            f"{bid.volume_mwh:.2f} MWh @ ₹{bid.price_rs_per_kwh:.2f}/kWh → {bid_id}"
        )
        return bid_id

    async def get_bid_status(self, bid_id: str) -> BidResult:
        return self._simulate_bid_result(bid_id)
