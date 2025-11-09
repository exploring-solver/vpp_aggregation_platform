"""
Generate synthetic telemetry dataset in TelemetryData format.

TelemetryData fields:
- dc_id: str
- timestamp: ISO8601 str
- cpu_usage: float (0-100)
- network_mb_sent: float
- network_mb_recv: float
- soc: float (0-100)
- power_kw: float
- freq: float (Hz)
- load_factor: float (0-100)
- meta: dict (optional extra fields)
"""
import argparse
import csv
import json
import math
import os
import random
from datetime import datetime, timedelta
from uuid import uuid4

ISO_FMT = "%Y-%m-%dT%H:%M:%S%z"

def generate_dc_id():
    # DC + last 4 of timestamp + 4-digit random
    ts = int(datetime.utcnow().timestamp() * 1000)
    return f"DC{ts % 10000:04d}{random.randint(1000,9999)}"

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def is_anomaly(telemetry_window):
    """Check if there's an anomaly in the telemetry window"""
    if not telemetry_window:
        return False
    # Check for spikes in power_kw or abnormal frequency
    for data in telemetry_window:
        if data['meta'].get('event') == 'spike':
            return True
        if abs(data['power_kw']) > 50.0:  # Large power deviation
            return True
        if abs(data['freq'] - 50.0) > 0.5 and abs(data['freq'] - 60.0) > 0.5:  # Frequency deviation
            return True
    return False

def aggregate_telemetry(telemetry_window):
    """Aggregate telemetry data for a time window"""
    if not telemetry_window:
        return None
    
    # Take the last timestamp and dc_id from the window
    result = {
        "dc_id": telemetry_window[-1]["dc_id"],
        "timestamp": telemetry_window[-1]["timestamp"],
    }
    
    # Calculate averages for numeric fields
    numeric_fields = ['cpu_usage', 'network_mb_sent', 'network_mb_recv', 
                     'soc', 'power_kw', 'freq', 'load_factor']
    
    for field in numeric_fields:
        values = [x[field] for x in telemetry_window]
        result[field] = round(sum(values) / len(values), 3)
    
    # Aggregate meta information
    result["meta"] = {
        "hostname": telemetry_window[-1]["meta"]["hostname"],
        "event": "spike" if any(x["meta"]["event"] == "spike" for x in telemetry_window) else "",
        "temperature_c": round(sum(x["meta"]["temperature_c"] for x in telemetry_window) / len(telemetry_window), 1),
        "samples_aggregated": len(telemetry_window)
    }
    
    return result

def make_time_series_for_node(dc_id, start_dt, samples, interval_s,
                              capacity_kwh=100.0, base_load_kw=10.0,
                              diurnal_amp_kw=8.0, noise_kw=1.5,
                              seed=None):
    """Generate and aggregate telemetry data for one node"""
    if seed is not None:
        rnd = random.Random(seed)
    else:
        rnd = random.Random()
    soc = rnd.uniform(40.0, 95.0)  # initial SOC %
    # small per-node bias
    freq_nominal = rnd.choice([50.0, 60.0])
    
    # Buffer to store 5-second readings before aggregation
    telemetry_buffer = []
    
    for i in range(samples):
        ts = start_dt + timedelta(seconds=i * interval_s)
        hour = ts.hour + ts.minute / 60.0
        # Diurnal load: sine wave (higher during day)
        diurnal = math.sin((hour / 24.0) * 2 * math.pi)
        # power_kw base + diurnal contribution + noise + rare spike
        diurnal_component = diurnal_amp_kw * max(0, diurnal)  # mostly daytime
        base_noise = rnd.gauss(0, noise_kw)
        event = 0.0
        # occasional high-load event
        if rnd.random() < 0.002:  # ~0.2% chance per sample
            event = rnd.uniform(10, 40) * (1 if rnd.random() < 0.6 else -1)  # charge or discharge spike
        power_kw = clamp(base_load_kw + diurnal_component + base_noise + event, -50.0, 200.0)
        # load_factor roughly proportional to power
        load_factor = clamp((power_kw / max(base_load_kw, 0.1)) * 10.0 + rnd.gauss(0, 5.0), 0.0, 100.0)
        # cpu usage correlated to load_factor
        cpu_usage = clamp(load_factor * rnd.uniform(0.7, 1.1) + rnd.gauss(0, 5.0), 0.0, 100.0)
        # network random-ish around load
        network_mb_sent = max(0.0, rnd.gauss(5.0 + power_kw * 0.2, 2.0))
        network_mb_recv = max(0.0, rnd.gauss(4.0 + power_kw * 0.15, 2.0))
        # SOC change: positive power_kw -> discharging (reduce SOC), negative -> charging
        dt_hours = interval_s / 3600.0
        # If power is consumption from grid, assume SOC decreases with discharge; adjust sign as needed.
        soc_delta = - (power_kw * dt_hours) / max(capacity_kwh, 1.0) * 100.0
        # small self-discharge
        soc_delta += rnd.gauss(-0.01, 0.02)
        soc = clamp(soc + soc_delta, 0.0, 100.0)
        # frequency: nominal +/- small deviation, slightly worse if power spikes
        imbalance = power_kw - base_load_kw
        freq_noise = rnd.gauss(0, 0.02) + (-imbalance * 0.0001)
        freq = round(freq_nominal + freq_noise, 3)
        # meta
        meta = {
            "hostname": f"{dc_id.lower()}-host-{i%6}",
            "event": "spike" if abs(event) > 0.1 else "",
            "temperature_c": round(rnd.uniform(30.0, 60.0) + (power_kw * 0.05), 1),
        }
        telemetry = {
            "dc_id": dc_id,
            "timestamp": ts.isoformat(),
            "cpu_usage": round(cpu_usage, 3),
            "network_mb_sent": round(network_mb_sent, 3),
            "network_mb_recv": round(network_mb_recv, 3),
            "soc": round(soc, 3),
            "power_kw": round(power_kw, 4),
            "freq": freq,
            "load_factor": round(load_factor, 3),
            "meta": meta
        }
        
        telemetry_buffer.append(telemetry)
        
        # Determine aggregation window size
        FIVE_MIN_SAMPLES = 300 // interval_s  # 300 seconds = 5 minutes
        ONE_MIN_SAMPLES = 60 // interval_s    # 60 seconds = 1 minute
        
        # Check if we have enough samples for aggregation
        if len(telemetry_buffer) >= FIVE_MIN_SAMPLES:
            # Check for anomalies in the last minute of data
            last_minute_data = telemetry_buffer[-ONE_MIN_SAMPLES:]
            if is_anomaly(last_minute_data):
                # If anomaly detected, aggregate in 1-minute windows
                while len(telemetry_buffer) >= ONE_MIN_SAMPLES:
                    window = telemetry_buffer[:ONE_MIN_SAMPLES]
                    telemetry_buffer = telemetry_buffer[ONE_MIN_SAMPLES:]
                    aggregated = aggregate_telemetry(window)
                    if aggregated:
                        yield aggregated
            else:
                # No anomaly, aggregate in 5-minute windows
                window = telemetry_buffer[:FIVE_MIN_SAMPLES]
                telemetry_buffer = telemetry_buffer[FIVE_MIN_SAMPLES:]
                aggregated = aggregate_telemetry(window)
                if aggregated:
                    yield aggregated
    
    # Handle any remaining data in buffer
    if telemetry_buffer:
        if is_anomaly(telemetry_buffer[-ONE_MIN_SAMPLES:] if len(telemetry_buffer) >= ONE_MIN_SAMPLES else telemetry_buffer):
            # Aggregate remaining data in 1-minute chunks
            while len(telemetry_buffer) >= ONE_MIN_SAMPLES:
                window = telemetry_buffer[:ONE_MIN_SAMPLES]
                telemetry_buffer = telemetry_buffer[ONE_MIN_SAMPLES:]
                aggregated = aggregate_telemetry(window)
                if aggregated:
                    yield aggregated
        else:
            # Aggregate all remaining data
            aggregated = aggregate_telemetry(telemetry_buffer)
            if aggregated:
                yield aggregated

def generate_dataset(output_path, nodes=10, duration_hours=24, interval_s=60,
                     capacity_kwh=100.0, base_load_kw=10.0, diurnal_amp_kw=8.0,
                     seed=42, format="csv"):
    random.seed(seed)
    start_dt = datetime.utcnow() - timedelta(hours=duration_hours)
    samples_per_node = int((duration_hours * 3600) // interval_s)
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    # open writer based on format
    written = 0
    if format == "csv":
        fieldnames = ["dc_id", "timestamp", "cpu_usage", "network_mb_sent",
                      "network_mb_recv", "soc", "power_kw", "freq", "load_factor", "meta"]
        with open(output_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for n in range(nodes):
                dc_id = f"DC{str(n+1).zfill(4)}"  # deterministic ids per-run
                node_seed = seed + n
                for row in make_time_series_for_node(dc_id, start_dt, samples_per_node, interval_s,
                                                     capacity_kwh, base_load_kw, diurnal_amp_kw, seed=node_seed):
                    # store meta as JSON string in CSV
                    row_copy = dict(row)
                    row_copy["meta"] = json.dumps(row_copy.get("meta", {}))
                    writer.writerow(row_copy)
                    written += 1
    else:
        # jsonl
        with open(output_path, "w") as f:
            for n in range(nodes):
                dc_id = f"DC{str(n+1).zfill(4)}"
                node_seed = seed + n
                for row in make_time_series_for_node(dc_id, start_dt, samples_per_node, interval_s,
                                                     capacity_kwh, base_load_kw, diurnal_amp_kw, seed=node_seed):
                    f.write(json.dumps(row) + "\n")
                    written += 1

    # Report actual aggregated records written and original raw samples estimate
    raw_samples = nodes * samples_per_node
    print(f"Generated {nodes} nodes x {samples_per_node} raw samples = {raw_samples} input samples -> {written} aggregated records written -> {output_path}")
    return written
# Hard-coded output for 30 days @ 5s sampling
OUTPUT_PATH = "data/telemetry_10nodes_30days_aggregated.csv"

def cli():
    parser = argparse.ArgumentParser(description="Generate synthetic TelemetryData dataset")
    # output path is hard-coded via OUTPUT_PATH above
    parser.add_argument("--nodes", "-n", type=int, default=1, help="Number of nodes to simulate")
    parser.add_argument("--hours", "-H", type=int, default=24*30, help="Duration in hours per node (default: 30 days)")
    parser.add_argument("--interval", "-i", type=int, default=5, help="Sampling interval in seconds (default: 5s)")
    parser.add_argument("--capacity", type=float, default=100.0, help="Battery capacity (kWh) per node")
    parser.add_argument("--base-load", type=float, default=10.0, help="Base load (kW) per node")
    parser.add_argument("--diurnal-amp", type=float, default=8.0, help="Diurnal amplitude (kW)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--debug", action="store_true", help="Print small sample of written aggregated records and counts")
    args = parser.parse_args()
    fmt = "csv" if OUTPUT_PATH.lower().endswith(".csv") else "jsonl"
    written = generate_dataset(OUTPUT_PATH, nodes=args.nodes, duration_hours=args.hours,
                      interval_s=args.interval, capacity_kwh=args.capacity,
                      base_load_kw=args.base_load, diurnal_amp_kw=args.diurnal_amp,
                      seed=args.seed, format=fmt)
    if args.debug:
        print(f"[debug] aggregated records written: {written}")

if __name__ == "__main__":
    cli()