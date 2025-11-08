import paho.mqtt.client as mqtt
import json
import logging
import socket
import traceback
from typing import Callable, Optional
from urllib.parse import urlparse
import os

logger = logging.getLogger(__name__)


class MQTTClient:
    """MQTT client wrapper for edge node communication

    Enhancements:
    - Use urlparse for robust broker URL parsing
    - Do a quick socket reachability check before calling paho.connect
    - Emit richer debug logs and full exception traces
    - Pick up optional MQTT_USERNAME/MQTT_PASSWORD from environment
    """

    def __init__(self, broker_url: str, dc_id: str, on_control_callback: Callable):
        self.broker_url = broker_url
        self.dc_id = dc_id
        self.on_control_callback = on_control_callback
        self.client: Optional[mqtt.Client] = None
        self.connected = False

        # Parse broker URL
        self._parse_broker_url()

    def _parse_broker_url(self):
        """Parse MQTT broker URL robustly.

        Accepts forms like:
        - mqtt://host:port
        - mqtts://host:port
        - host:port
        - host
        """
        try:
            parsed = urlparse(self.broker_url)

            # urlparse puts host in .hostname and port in .port when scheme is present
            if parsed.hostname:
                self.host = parsed.hostname
                self.port = parsed.port or 1883
                self.use_tls = parsed.scheme in ("mqtts", "tls", "ssl")
            else:
                # Fallback: broker_url may be provided without scheme (e.g. host:1883)
                url = self.broker_url
                if url.startswith("mqtt://"):
                    url = url.replace("mqtt://", "")
                if url.startswith("mqtts://"):
                    url = url.replace("mqtts://", "")
                if ":" in url:
                    host, port_str = url.split(":", 1)
                    self.host = host
                    try:
                        self.port = int(port_str)
                    except ValueError:
                        self.port = 1883
                else:
                    self.host = url
                    self.port = 1883
                self.use_tls = self.broker_url.startswith("mqtts://")

            logger.debug(f"Parsed MQTT broker URL '{self.broker_url}' -> host={self.host}, port={self.port}, use_tls={self.use_tls}")

        except Exception:
            logger.error("Failed to parse MQTT broker URL, falling back to plain parsing")
            logger.error(traceback.format_exc())
            # Best-effort fallback
            url = self.broker_url
            if ":" in url:
                host, port_str = url.split(":", 1)
                self.host = host
                try:
                    self.port = int(port_str)
                except ValueError:
                    self.port = 1883
            else:
                self.host = url
                self.port = 1883
            self.use_tls = self.broker_url.startswith("mqtts://")

    async def connect(self):
        """Connect to MQTT broker with improved diagnostics"""
        self.client = mqtt.Client(
            client_id=f"edge_{self.dc_id}_{id(self)}",
            clean_session=True,
        )

        # Set callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

        # Credentials (optional)
        username = os.getenv("MQTT_USERNAME")
        password = os.getenv("MQTT_PASSWORD")
        if username:
            logger.debug("Using MQTT username from environment")
            self.client.username_pw_set(username, password or None)

        # Set LWT (Last Will and Testament)
        lwt_topic = f"edge/{self.dc_id}/status"
        lwt_message = json.dumps({"online": False, "timestamp": None})
        self.client.will_set(lwt_topic, lwt_message, qos=1, retain=True)

        logger.info(f"Attempting MQTT connection to {self.host}:{self.port} (use_tls={self.use_tls})")

        # Quick reachability test to produce clearer errors when connection is refused
        try:
            logger.debug("Performing socket connect test to MQTT broker")
            with socket.create_connection((self.host, self.port), timeout=5) as sock:
                logger.debug(f"Socket test succeeded: {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"Socket-level connection to {self.host}:{self.port} failed: {e}")
            logger.debug(traceback.format_exc())
            # Still attempt paho connect to surface the same error via that path, but raise afterwards to fail fast
            try:
                self.client.connect(self.host, self.port, keepalive=60)
                self.client.loop_start()
            except Exception:
                logger.error("paho-mqtt connect also failed; re-raising exception")
                logger.debug(traceback.format_exc())
                raise
            return

        # If socket test passed, proceed with paho connect
        try:
            self.client.connect(self.host, self.port, keepalive=60)
            self.client.loop_start()
            logger.info(f"MQTT client connecting to {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"MQTT connection error: {e}")
            logger.debug(traceback.format_exc())
            raise
    
    def _on_connect(self, client, userdata, flags, rc):
        """Callback when connected to broker"""
        if rc == 0:
            self.connected = True
            logger.info(f"MQTT connected successfully")
            
            # Subscribe to control topic
            control_topic = f"edge/{self.dc_id}/control"
            client.subscribe(control_topic, qos=1)
            logger.info(f"Subscribed to {control_topic}")
            
            # Publish online status
            status_topic = f"edge/{self.dc_id}/status"
            client.publish(
                status_topic,
                json.dumps({"online": True, "timestamp": None}),
                qos=1,
                retain=True
            )
        else:
            logger.error(f"MQTT connection failed with code {rc}")
            self.connected = False
    
    def _on_disconnect(self, client, userdata, rc):
        """Callback when disconnected from broker"""
        self.connected = False
        if rc != 0:
            logger.warning(f"MQTT unexpected disconnect (code {rc}), will auto-reconnect")
        else:
            logger.info("MQTT disconnected cleanly")
    
    def _on_message(self, client, userdata, msg):
        """Callback when message received"""
        try:
            payload = json.loads(msg.payload.decode())
            logger.info(f"Received message on {msg.topic}: {payload}")
            
            # Handle control commands
            if "/control" in msg.topic:
                self.on_control_callback(payload)
                
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")
    
    async def publish_telemetry(self, telemetry: dict):
        """Publish telemetry data"""
        if not self.client or not self.connected:
            logger.warning("MQTT not connected, cannot publish telemetry")
            return
        
        topic = f"edge/{self.dc_id}/telemetry"
        message = json.dumps(telemetry)
        
        result = self.client.publish(topic, message, qos=0)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.error(f"Failed to publish telemetry: {result.rc}")
    
    def disconnect(self):
        """Disconnect from broker"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("MQTT client disconnected")
