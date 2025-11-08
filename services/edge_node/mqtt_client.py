import paho.mqtt.client as mqtt
import json
import logging
from typing import Callable, Optional

logger = logging.getLogger(__name__)

class MQTTClient:
    """MQTT client wrapper for edge node communication"""
    
    def __init__(self, broker_url: str, dc_id: str, on_control_callback: Callable):
        self.broker_url = broker_url
        self.dc_id = dc_id
        self.on_control_callback = on_control_callback
        self.client: Optional[mqtt.Client] = None
        self.connected = False
        
        # Parse broker URL
        self._parse_broker_url()
        
    def _parse_broker_url(self):
        """Parse MQTT broker URL"""
        # mqtt://host:port or mqtts://host:port
        url = self.broker_url.replace("mqtt://", "").replace("mqtts://", "")
        if ":" in url:
            self.host, port_str = url.split(":")
            self.port = int(port_str)
        else:
            self.host = url
            self.port = 1883
        
        self.use_tls = self.broker_url.startswith("mqtts://")
    
    async def connect(self):
        """Connect to MQTT broker"""
        self.client = mqtt.Client(
            client_id=f"edge_{self.dc_id}_{id(self)}",
            clean_session=True
        )
        
        # Set callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        
        # Set LWT (Last Will and Testament)
        lwt_topic = f"edge/{self.dc_id}/status"
        lwt_message = json.dumps({"online": False, "timestamp": None})
        self.client.will_set(lwt_topic, lwt_message, qos=1, retain=True)
        
        try:
            self.client.connect(self.host, self.port, keepalive=60)
            self.client.loop_start()
            logger.info(f"MQTT client connecting to {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"MQTT connection error: {e}")
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
