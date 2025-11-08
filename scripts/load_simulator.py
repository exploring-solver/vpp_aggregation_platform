#!/usr/bin/env python3
"""
Data Center Load Simulator
Simulates realistic workload patterns on your laptop to generate varied telemetry data
"""

import multiprocessing
import threading
import time
import random
import math
import sys
from datetime import datetime

class LoadSimulator:
    def __init__(self):
        self.active_workers = []
        self.stop_flag = threading.Event()
        self.current_pattern = None
        
    def cpu_intensive_task(self, duration=1):
        """CPU-intensive computation"""
        start = time.time()
        while time.time() - start < duration:
            # Prime number calculation (CPU intensive)
            result = sum(i for i in range(1000000) if self._is_prime(i))
    
    def _is_prime(self, n):
        """Check if number is prime (CPU intensive)"""
        if n < 2:
            return False
        for i in range(2, int(math.sqrt(n)) + 1):
            if n % i == 0:
                return False
        return True
    
    def memory_intensive_task(self, size_mb=100, duration=1):
        """Memory-intensive operations"""
        start = time.time()
        # Allocate memory
        data = []
        while time.time() - start < duration:
            # Create large lists
            chunk = [random.random() for _ in range(100000)]
            data.append(chunk)
            if len(data) > size_mb:
                data.pop(0)
            time.sleep(0.1)
    
    def mixed_workload(self, duration=1):
        """Mixed CPU and memory workload"""
        start = time.time()
        data = []
        while time.time() - start < duration:
            # CPU work
            _ = [i**2 for i in range(100000)]
            # Memory work
            data.append([random.random() for _ in range(50000)])
            if len(data) > 10:
                data.pop(0)
    
    def generate_load_pattern(self, pattern_name, duration):
        """
        Generate different load patterns:
        - idle: Minimal load
        - steady: Constant moderate load
        - burst: Sudden spikes
        - gradual: Slowly increasing/decreasing
        - peak_hours: Simulates business hours traffic
        - batch_processing: Periodic high loads
        """
        
        print(f"🔄 Starting pattern: {pattern_name} for {duration}s")
        start_time = time.time()
        
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            if pattern_name == "idle":
                self._idle_pattern()
            elif pattern_name == "steady":
                self._steady_pattern()
            elif pattern_name == "burst":
                self._burst_pattern()
            elif pattern_name == "gradual":
                self._gradual_pattern(start_time, duration)
            elif pattern_name == "peak_hours":
                self._peak_hours_pattern(start_time, duration)
            elif pattern_name == "batch_processing":
                self._batch_processing_pattern()
            elif pattern_name == "random":
                self._random_pattern()
            else:
                time.sleep(1)
    
    def _idle_pattern(self):
        """Minimal load - just sleep"""
        time.sleep(5)
    
    def _steady_pattern(self):
        """Constant moderate load"""
        # Run 2 threads with moderate work
        threads = []
        for _ in range(2):
            t = threading.Thread(target=self.cpu_intensive_task, args=(1,))
            t.start()
            threads.append(t)
        
        for t in threads:
            t.join()
        
        time.sleep(1)
    
    def _burst_pattern(self):
        """Sudden burst of activity"""
        # Random bursts
        if random.random() > 0.7:  # 30% chance of burst
            print("  ⚡ BURST!")
            # Intense load
            threads = []
            for _ in range(multiprocessing.cpu_count()):
                t = threading.Thread(target=self.cpu_intensive_task, args=(2,))
                t.start()
                threads.append(t)
            
            for t in threads:
                t.join()
        else:
            # Low load
            time.sleep(3)
    
    def _gradual_pattern(self, start_time, total_duration):
        """Gradually increase then decrease load"""
        elapsed = time.time() - start_time
        progress = elapsed / total_duration
        
        # Sine wave pattern
        intensity = (math.sin(progress * 2 * math.pi) + 1) / 2  # 0 to 1
        num_threads = max(1, int(intensity * multiprocessing.cpu_count()))
        
        print(f"  📊 Intensity: {intensity:.2f} ({num_threads} threads)")
        
        threads = []
        for _ in range(num_threads):
            t = threading.Thread(target=self.cpu_intensive_task, args=(0.5,))
            t.start()
            threads.append(t)
        
        for t in threads:
            t.join()
        
        time.sleep(1)
    
    def _peak_hours_pattern(self, start_time, total_duration):
        """Simulate business hours with morning/evening peaks"""
        elapsed = time.time() - start_time
        # Normalize to 24-hour cycle (compressed into duration)
        hour_of_day = (elapsed / total_duration) * 24
        
        # Peak hours: 9-11 AM and 2-4 PM
        if (9 <= hour_of_day <= 11) or (14 <= hour_of_day <= 16):
            load_level = "HIGH"
            num_threads = max(3, multiprocessing.cpu_count() - 1)
        elif (8 <= hour_of_day <= 9) or (11 <= hour_of_day <= 14) or (16 <= hour_of_day <= 18):
            load_level = "MEDIUM"
            num_threads = max(2, multiprocessing.cpu_count() // 2)
        else:
            load_level = "LOW"
            num_threads = 1
        
        print(f"  🕐 Hour {hour_of_day:.1f} - {load_level} load ({num_threads} threads)")
        
        threads = []
        for _ in range(num_threads):
            t = threading.Thread(target=self.mixed_workload, args=(1,))
            t.start()
            threads.append(t)
        
        for t in threads:
            t.join()
        
        time.sleep(0.5)
    
    def _batch_processing_pattern(self):
        """Simulate batch processing jobs"""
        # 20% chance of batch job starting
        if random.random() > 0.8:
            print("  📦 BATCH JOB STARTED!")
            # High load for 10-15 seconds
            batch_duration = random.uniform(10, 15)
            start = time.time()
            
            while time.time() - start < batch_duration and not self.stop_flag.is_set():
                threads = []
                for _ in range(multiprocessing.cpu_count()):
                    t = threading.Thread(target=self.mixed_workload, args=(1,))
                    t.start()
                    threads.append(t)
                
                for t in threads:
                    t.join()
            
            print("  ✅ Batch job completed")
        else:
            # Normal background load
            time.sleep(2)
    
    def _random_pattern(self):
        """Completely random load levels"""
        num_threads = random.randint(0, multiprocessing.cpu_count())
        duration = random.uniform(0.5, 3)
        
        if num_threads == 0:
            print("  😴 Idle")
            time.sleep(duration)
        else:
            print(f"  🎲 Random load: {num_threads} threads")
            threads = []
            for _ in range(num_threads):
                t = threading.Thread(target=self.cpu_intensive_task, args=(duration,))
                t.start()
                threads.append(t)
            
            for t in threads:
                t.join()
    
    def run_pattern(self, pattern_name, duration):
        """Run a specific load pattern"""
        self.stop_flag.clear()
        self.current_pattern = pattern_name
        self.generate_load_pattern(pattern_name, duration)
    
    def stop(self):
        """Stop all load generation"""
        self.stop_flag.set()
        print("🛑 Stopping load simulator...")


class InteractiveLoadSimulator:
    def __init__(self):
        self.simulator = LoadSimulator()
        self.running_thread = None
        
    def print_menu(self):
        print("\n" + "="*70)
        print("🏭 DATA CENTER LOAD SIMULATOR")
        print("="*70)
        print("\nLoad Patterns:")
        print("  1. IDLE          - Minimal load, low power consumption")
        print("  2. STEADY        - Constant moderate load (50-60% CPU)")
        print("  3. BURST         - Random sudden spikes (simulates cache misses)")
        print("  4. GRADUAL       - Smooth sine wave increase/decrease")
        print("  5. PEAK HOURS    - Morning/afternoon peaks (9-11, 2-4)")
        print("  6. BATCH JOBS    - Periodic intense processing")
        print("  7. RANDOM        - Unpredictable varying loads")
        print("  8. CUSTOM        - Sequence of patterns")
        print()
        print("  9. STOP          - Stop current pattern")
        print("  0. EXIT          - Quit simulator")
        print("="*70)
        print("\n💡 Tip: Run edge_node_client.py in another terminal to see")
        print("   real-time telemetry changes based on these load patterns!")
        print()
    
    def run_pattern_thread(self, pattern, duration):
        """Run pattern in separate thread"""
        if self.running_thread and self.running_thread.is_alive():
            print("⚠️  A pattern is already running. Stop it first (option 9).")
            return
        
        self.running_thread = threading.Thread(
            target=self.simulator.run_pattern,
            args=(pattern, duration)
        )
        self.running_thread.daemon = True
        self.running_thread.start()
        print(f"✅ Pattern '{pattern}' started for {duration} seconds")
        print("   Watch your edge_node_client.py output for changes!")
    
    def run_custom_sequence(self):
        """Run a predefined sequence of patterns"""
        print("\n🎬 Running custom sequence...")
        sequences = [
            ("idle", 20, "Start calm"),
            ("gradual", 30, "Ramp up"),
            ("peak_hours", 60, "Peak traffic"),
            ("burst", 30, "Unexpected spikes"),
            ("batch_processing", 40, "Background jobs"),
            ("gradual", 30, "Wind down"),
            ("idle", 20, "Back to idle")
        ]
        
        print("\nSequence plan:")
        for i, (pattern, duration, desc) in enumerate(sequences, 1):
            print(f"  {i}. {pattern:15s} ({duration:2d}s) - {desc}")
        
        confirm = input("\nStart sequence? (y/n): ").strip().lower()
        if confirm != 'y':
            return
        
        total_duration = sum(d for _, d, _ in sequences)
        print(f"\n⏱️  Total duration: {total_duration} seconds (~{total_duration//60} minutes)")
        print("🚀 Starting sequence...\n")
        
        for pattern, duration, desc in sequences:
            print(f"\n{'='*70}")
            print(f"📍 {desc}")
            self.simulator.run_pattern(pattern, duration)
            if self.simulator.stop_flag.is_set():
                break
        
        print("\n✅ Sequence completed!")
    
    def run(self):
        """Main interactive loop"""
        patterns = {
            '1': ('idle', 30),
            '2': ('steady', 60),
            '3': ('burst', 45),
            '4': ('gradual', 60),
            '5': ('peak_hours', 120),
            '6': ('batch_processing', 90),
            '7': ('random', 60)
        }
        
        while True:
            self.print_menu()
            choice = input("Enter your choice (0-9): ").strip()
            
            if choice == '0':
                if self.running_thread and self.running_thread.is_alive():
                    print("⚠️  Stopping current pattern first...")
                    self.simulator.stop()
                    self.running_thread.join(timeout=5)
                print("\n👋 Goodbye!")
                break
            
            elif choice == '9':
                if self.running_thread and self.running_thread.is_alive():
                    print("🛑 Stopping current pattern...")
                    self.simulator.stop()
                    self.running_thread.join(timeout=5)
                    print("✅ Stopped")
                else:
                    print("ℹ️  No pattern is currently running")
            
            elif choice == '8':
                self.run_custom_sequence()
            
            elif choice in patterns:
                pattern_name, default_duration = patterns[choice]
                
                # Ask for duration
                duration_input = input(f"Duration in seconds (default {default_duration}): ").strip()
                try:
                    duration = int(duration_input) if duration_input else default_duration
                except ValueError:
                    duration = default_duration
                
                self.run_pattern_thread(pattern_name, duration)
            
            else:
                print("❌ Invalid choice. Please enter 0-9.")
            
            input("\nPress Enter to continue...")


def main():
    """Entry point"""
    print("="*70)
    print("🏭 DATA CENTER LOAD SIMULATOR")
    print("="*70)
    print(f"\n💻 System Info:")
    print(f"   CPU Cores: {multiprocessing.cpu_count()}")
    print(f"   Python: {sys.version.split()[0]}")
    print("\n📊 This tool will generate realistic CPU/memory loads to simulate")
    print("   data center workload patterns. Use with edge_node_client.py to")
    print("   see how telemetry data changes under different load conditions.")
    print("\n⚠️  WARNING: This will increase your laptop's CPU/memory usage!")
    print("   Close other applications if needed.")
    
    confirm = input("\nReady to start? (y/n): ").strip().lower()
    if confirm != 'y':
        print("👋 Cancelled")
        return
    
    simulator = InteractiveLoadSimulator()
    
    try:
        simulator.run()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        simulator.simulator.stop()
        print("👋 Goodbye!")


if __name__ == "__main__":
    main()