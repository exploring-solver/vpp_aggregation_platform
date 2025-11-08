"""
Complete testing pipeline for synthetic data
Ingests CSV data and tests all ML components
"""
import asyncio
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import json
from src.config.db import db_manager
from src.utils.logger import logger
from src.orchestrator.hybrid_orchestrator import hybrid_orchestrator
from src.controllers.power_flow_controller import power_controller
from src.models.foundation_forecaster import foundation_forecaster
from src.data.data_pipeline import data_pipeline

class SyntheticDataTester:
    """Test ML pipeline with synthetic data"""
    
    def __init__(self, csv_path: str):
        self.csv_path = csv_path
        self.df = None
        self.nodes = []
        
    async def load_and_prepare_data(self):
        """Load CSV and prepare for ingestion"""
        try:
            logger.info(f"📂 Loading synthetic data from {self.csv_path}")
            
            # Load CSV
            self.df = pd.read_csv(self.csv_path)
            
            logger.info(f"✅ Loaded {len(self.df)} records")
            logger.info(f"📊 Columns: {list(self.df.columns)}")
            logger.info(f"🏢 Unique data centers: {self.df['dc_id'].nunique()}")
            
            # Get unique nodes
            self.nodes = self.df['dc_id'].unique().tolist()
            logger.info(f"🔢 Nodes to process: {self.nodes}")
            
            # Parse metadata if it's JSON string
            if 'meta' in self.df.columns and isinstance(self.df['meta'].iloc[0], str):
                self.df['meta_parsed'] = self.df['meta'].apply(
                    lambda x: json.loads(x) if pd.notna(x) else {}
                )
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error loading data: {e}")
            return False
    
    async def ingest_to_mongodb(self):
        """Ingest synthetic data into MongoDB"""
        try:
            logger.info("📥 Starting data ingestion to MongoDB...")
            
            await db_manager.connect_mongodb()
            
            telemetry_collection = db_manager.mongo_db['telemetries']
            metadata_collection = db_manager.mongo_db['metadatas']
            
            telemetry_records = []
            
            for idx, row in self.df.iterrows():
                # Parse metadata
                meta = {}
                if 'meta_parsed' in row and isinstance(row['meta_parsed'], dict):
                    meta = row['meta_parsed']
                
                # FIX: Convert SOC properly (0-1 to 0-100)
                soc_value = float(row['soc'])
                battery_level = soc_value * 100 if soc_value <= 1 else soc_value
                
                # Create telemetry record
                record = {
                    'nodeId': str(row['dc_id']),
                    'timestamp': pd.to_datetime(row['timestamp']),
                    
                    # Core metrics
                    'powerOutput': float(row['power_kw']),
                    'voltage': 400.0,
                    'current': float(row['power_kw']) / 400.0 * 1000,
                    'frequency': float(row['freq']),
                    
                    # Battery - FIXED SOC conversion
                    'batteryLevel': battery_level,  # Now properly 0-100%
                    'efficiency': float(row.get('load_factor', 0.8)) * 100,
                    'temperature': meta.get('temperature_c', 25.0),
                    
                    # Grid metrics
                    'gridMetrics': {
                        'gridFrequency': float(row['freq']),
                        'gridVoltage': 400.0,
                        'powerFactor': 0.95,
                        'harmonicDistortion': 2.0,
                        'reactivePower': 0.0
                    },
                    
                    # Performance
                    'performance': {
                        'capacity': float(row['power_kw']),
                        'availability': 100.0,
                        'reliability': 100.0,
                        'maintenanceStatus': 'operational'
                    },
                    
                    # Data quality
                    'dataQuality': {
                        'completeness': 1.0,
                        'accuracy': 1.0,
                        'source': 'synthetic',
                        'validated': True
                    },
                    
                    # Additional metrics
                    'metrics': {
                        'cpu_usage': float(row.get('cpu_usage', 0)),
                        'network_rx': float(row.get('network_mb_recv', 0)),
                        'network_tx': float(row.get('network_mb_sent', 0)),
                        'load_factor': float(row.get('load_factor', 0))
                    },
                    
                    # Weather (simulated)
                    'weatherConditions': {
                        'solarIrradiance': 500.0 if 6 <= pd.to_datetime(row['timestamp']).hour <= 18 else 0.0,
                        'windSpeed': 5.0,
                        'ambientTemperature': meta.get('temperature_c', 25.0),
                        'humidity': 60.0,
                        'cloudCover': 30.0,
                        'precipitation': 0.0
                    },
                    
                    'alarms': []
                }
                
                telemetry_records.append(record)
            
            # Batch insert
            if telemetry_records:
                result = await telemetry_collection.insert_many(telemetry_records)
                logger.info(f"✅ Inserted {len(result.inserted_ids)} telemetry records")
                
                # Log sample SOC values to verify
                sample_soc = [r['batteryLevel'] for r in telemetry_records[:5]]
                logger.info(f"Sample battery levels: {sample_soc}")
            
            # Create metadata for each node
            for node_id in self.nodes:
                node_data = self.df[self.df['dc_id'] == node_id]
                avg_power = node_data['power_kw'].mean()
                
                metadata = {
                    'nodeId': str(node_id),
                    'dataCenterId': str(node_id),
                    
                    'location': {
                        'coordinates': [77.2090, 28.6139],
                        'address': f"Data Center {node_id}",
                        'region': 'Delhi',
                        'country': 'India',
                        'timezone': 'Asia/Kolkata'
                    },
                    
                    'capacity': {
                        'rated': float(node_data['power_kw'].max()),
                        'available': float(avg_power),
                        'reserve': 50.0,
                        'storageCapacity': 1000.0,
                        'maxRampRate': 50.0,
                        'minOperatingLevel': 10.0
                    },
                    
                    'tariffs': {
                        'baseRate': 8.0,
                        'peakRate': 12.0,
                        'offPeakRate': 5.0,
                        'demandCharge': 200.0
                    },
                    
                    'technicalSpecs': {
                        'type': 'battery',
                        'manufacturer': 'Test Manufacturer',
                        'model': 'Synthetic Model',
                        'batteryTechnology': 'lithium-ion',
                        'installationDate': datetime.now(),
                        'expectedLifespan': 10
                    },
                    
                    'operational': {
                        'isActive': True,
                        'operationalMode': 'automatic',
                        'priority': 1
                    },
                    
                    'createdAt': datetime.now(),
                    'updatedAt': datetime.now()
                }
                
                await metadata_collection.update_one(
                    {'nodeId': str(node_id)},
                    {'$set': metadata},
                    upsert=True
                )
            
            logger.info(f"✅ Created/Updated metadata for {len(self.nodes)} nodes")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error ingesting data: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def test_forecasting(self):
        """Test forecasting with Prophet"""
        try:
            logger.info("\n" + "="*80)
            logger.info("🔮 Testing Forecasting Pipeline (Prophet)")
            logger.info("="*80)
            
            for node_id in self.nodes[:2]:
                logger.info(f"\n📊 Testing node: {node_id}")
                
                # Fetch historical data
                node_data = self.df[self.df['dc_id'] == node_id].sort_values('timestamp')
                
                if len(node_data) < 24:
                    logger.warning(f"⚠️  Not enough data for {node_id}")
                    continue
                
                # Get power values and timestamps
                power_values = node_data['power_kw'].values
                timestamps = pd.to_datetime(node_data['timestamp'])
                
                # Test zero-shot forecasting
                logger.info("🎯 Testing zero-shot forecast with Prophet...")
                predictions, lower, upper = foundation_forecaster.predict_zero_shot(
                    historical_data=power_values[-48:],
                    prediction_length=6,
                    timestamps=timestamps[-48:]
                )
                
                logger.info(f"✅ Prophet predictions: {predictions}")
                logger.info(f"   Confidence: [{lower[0]:.2f}, {upper[0]:.2f}]")
                
                # Test fine-tuning
                logger.info("🎓 Testing fine-tuning...")
                if len(power_values) >= 168:
                    result = await foundation_forecaster.fine_tune(
                        node_id=str(node_id),
                        training_data=power_values,
                        timestamps=timestamps
                    )
                    logger.info(f"✅ Fine-tuning result: {result['status']}")
                    if result['status'] == 'success':
                        logger.info(f"   Validation MAE: {result.get('validation_mae', 'N/A')}")
                        logger.info(f"   Validation MAPE: {result.get('validation_mape', 'N/A')}%")
                else:
                    logger.info(f"⏩ Skipping fine-tuning (need 168+ samples)")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error in forecasting test: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def test_orchestration(self):
        """Test complete orchestration pipeline"""
        try:
            logger.info("\n" + "="*80)
            logger.info("🎯 Testing Complete Orchestration")
            logger.info("="*80)
            
            # Initialize orchestrator
            await hybrid_orchestrator.initialize()
            
            # Run orchestration (advisory mode - no actual commands)
            logger.info(f"🚀 Running orchestration for {len(self.nodes)} nodes...")
            
            results = await hybrid_orchestrator.orchestrate_complete_cycle(
                node_ids=[str(n) for n in self.nodes[:3]],  # Test first 3 nodes
                execute_controls=False  # Advisory mode for testing
            )
            
            # Display results
            logger.info("\n📊 Orchestration Results:")
            logger.info(f"   Total revenue potential: ₹{results['total_revenue_potential']:.2f}")
            logger.info(f"   Total cost savings: ₹{results['total_cost_savings']:.2f}")
            logger.info(f"   Execution time: {results['execution_time_seconds']:.2f}s")
            
            # Show per-node results
            for node_id, node_result in results['nodes'].items():
                logger.info(f"\n   Node {node_id}:")
                
                if 'error' in node_result:
                    logger.error(f"      ❌ Error: {node_result['error']}")
                    continue
                
                # Forecasts
                if 'forecasts' in node_result and node_result['forecasts'].get('power'):
                    forecast = node_result['forecasts']['power']['forecast']
                    logger.info(f"      🔮 Power forecast: {forecast[:3]}...")
                
                # Optimization
                if 'optimizations' in node_result:
                    opt = node_result['optimizations']
                    logger.info(f"      ⚡ Recommended action: {opt.get('action')} ({opt.get('magnitude')} kW/%%)")
                
                # Revenue
                if 'revenue_potential' in node_result:
                    logger.info(f"      💰 Revenue potential: ₹{node_result['revenue_potential']:.2f}")
                
                # Explanation
                if 'explanation' in node_result:
                    logger.info(f"      💡 Explanation: {node_result['explanation'][:100]}...")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error in orchestration test: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def test_power_control(self):
        """Test power control commands (simulation only)"""
        try:
            logger.info("\n" + "="*80)
            logger.info("⚡ Testing Power Control")
            logger.info("="*80)
            
            test_node = str(self.nodes[0])
            logger.info(f"🎯 Testing on node: {test_node}")
            
            # Test all 4 commands
            commands = [
                {'action': 'Hold', 'magnitude': 0},
                {'action': 'Charge', 'magnitude': 100},
                {'action': 'Discharge', 'magnitude': 150},
                {'action': 'Load Deferral', 'magnitude': 25}
            ]
            
            for cmd in commands:
                logger.info(f"\n📡 Testing command: {cmd['action']} ({cmd['magnitude']})")
                
                result = await power_controller.control_node_power(
                    node_id=test_node,
                    action=cmd['action'],
                    magnitude=cmd['magnitude'],
                    reason=f"Test command: {cmd['action']}",
                    duration_minutes=1
                )
                
                if result['status'] == 'success':
                    logger.info(f"   ✅ Command accepted")
                else:
                    logger.warning(f"   ⚠️  Command rejected: {result.get('reason')}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error in power control test: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def test_data_pipeline(self):
        """Test data pipeline queries"""
        try:
            logger.info("\n" + "="*80)
            logger.info("📊 Testing Data Pipeline")
            logger.info("="*80)
            
            test_node = str(self.nodes[0])
            
            # Test telemetry fetch
            logger.info(f"📥 Fetching telemetry for {test_node}...")
            df = await data_pipeline.fetch_telemetry_data(
                node_id=test_node,
                limit=100
            )
            logger.info(f"✅ Fetched {len(df)} records")
            logger.info(f"   Columns: {list(df.columns)[:10]}...")
            
            # Test metadata fetch
            logger.info(f"📋 Fetching metadata for {test_node}...")
            metadata = await data_pipeline.fetch_metadata(node_id=test_node)
            if metadata:
                logger.info(f"✅ Metadata found: {metadata[0].get('dataCenterId')}")
            
            # Test LSTM dataset preparation
            logger.info(f"🔧 Preparing LSTM dataset...")
            X, y, meta = await data_pipeline.prepare_lstm_dataset(
                node_id=test_node,
                lookback=24,
                forecast_horizon=6
            )
            logger.info(f"✅ Dataset prepared:")
            logger.info(f"   X shape: {X.shape}")
            logger.info(f"   y shape: {y.shape}")
            logger.info(f"   Features: {meta.get('features', [])}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error in data pipeline test: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def run_all_tests(self):
        """Run complete test suite"""
        try:
            logger.info("\n" + "="*80)
            logger.info("🧪 STARTING COMPLETE TEST SUITE")
            logger.info("="*80)
            
            # Load data
            if not await self.load_and_prepare_data():
                logger.error("❌ Failed to load data")
                return False
            
            # Ingest to MongoDB
            if not await self.ingest_to_mongodb():
                logger.error("❌ Failed to ingest data")
                return False
            
            # Test data pipeline
            if not await self.test_data_pipeline():
                logger.error("❌ Data pipeline test failed")
                return False
            
            # Test forecasting
            if not await self.test_forecasting():
                logger.error("❌ Forecasting test failed")
                return False
            
            # Test power control
            if not await self.test_power_control():
                logger.error("❌ Power control test failed")
                return False
            
            # Test orchestration
            if not await self.test_orchestration():
                logger.error("❌ Orchestration test failed")
                return False
            
            logger.info("\n" + "="*80)
            logger.info("✅ ALL TESTS PASSED!")
            logger.info("="*80)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Test suite failed: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            await db_manager.close()

async def main():
    """Main test runner"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python test_with_synthetic_data.py <path_to_csv>")
        print("Example: python test_with_synthetic_data.py synthetic_data.csv")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    
    if not Path(csv_path).exists():
        print(f"❌ File not found: {csv_path}")
        sys.exit(1)
    
    tester = SyntheticDataTester(csv_path)
    success = await tester.run_all_tests()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())