import gymnasium as gym
from gymnasium import spaces
import numpy as np
from stable_baselines3 import PPO, DQN
from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback
from stable_baselines3.common.vec_env import DummyVecEnv
from typing import Dict, Tuple, Optional
import json
from pathlib import Path
from utils.logger import logger
from config.config import config

class GridBiddingEnv(gym.Env):
    """Custom Gymnasium environment for grid bidding optimization"""
    
    def __init__(self, historical_data: Dict = None):
        super().__init__()
        
        self.historical_data = historical_data or {}
        
        # State space: [SOC, grid_frequency, power_price, demand, time_of_day, day_of_week]
        self.observation_space = spaces.Box(
            low=np.array([0, 49.5, 0, 0, 0, 0]),
            high=np.array([100, 50.5, 1000, 10000, 23, 6]),
            dtype=np.float32
        )
        
        # Action space: [charge_rate, discharge_rate, bid_price]
        # 0: Do nothing, 1: Charge, 2: Discharge, 3: Bid high, 4: Bid low
        self.action_space = spaces.Discrete(5)
        
        # Episode parameters
        self.max_steps = 96  # 24 hours in 15-min intervals
        self.current_step = 0
        
        # Battery parameters
        self.battery_capacity = 1000  # kWh
        self.max_charge_rate = 250  # kW
        self.max_discharge_rate = 250  # kW
        self.efficiency = 0.95
        
        # Initial state
        self.soc = 50.0  # Start at 50% SOC
        self.grid_frequency = 50.0
        self.power_price = 100.0
        self.demand = 500.0
        
        self.state = self._get_state()
        
    def _get_state(self) -> np.ndarray:
        """Get current state observation"""
        hour = (self.current_step // 4) % 24
        day_of_week = (self.current_step // 96) % 7
        
        return np.array([
            self.soc,
            self.grid_frequency,
            self.power_price,
            self.demand,
            hour,
            day_of_week
        ], dtype=np.float32)
    
    def reset(self, seed: Optional[int] = None, options: Optional[dict] = None) -> Tuple[np.ndarray, dict]:
        """Reset environment to initial state"""
        super().reset(seed=seed)
        
        self.current_step = 0
        self.soc = np.random.uniform(30, 70)  # Random initial SOC
        self.grid_frequency = np.random.uniform(49.8, 50.2)
        self.power_price = np.random.uniform(50, 150)
        self.demand = np.random.uniform(300, 800)
        
        self.state = self._get_state()
        return self.state, {}
    
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, dict]:
        """Execute action and return next state, reward, done, info"""
        
        # Decode action
        charge_rate = 0
        discharge_rate = 0
        bid_multiplier = 1.0
        
        if action == 1:  # Charge
            charge_rate = self.max_charge_rate
        elif action == 2:  # Discharge
            discharge_rate = self.max_discharge_rate
        elif action == 3:  # Bid high price
            bid_multiplier = 1.2
        elif action == 4:  # Bid low price
            bid_multiplier = 0.8
        
        # Update SOC
        energy_charged = (charge_rate * 0.25 * self.efficiency) / self.battery_capacity * 100
        energy_discharged = (discharge_rate * 0.25 / self.efficiency) / self.battery_capacity * 100
        
        self.soc += energy_charged - energy_discharged
        self.soc = np.clip(self.soc, 0, 100)
        
        # Calculate reward
        reward = self._calculate_reward(action, charge_rate, discharge_rate, bid_multiplier)
        
        # Update environment dynamics
        self.current_step += 1
        self._update_dynamics()
        
        # Check if episode is done
        terminated = self.current_step >= self.max_steps
        truncated = False
        
        self.state = self._get_state()
        info = {
            'soc': self.soc,
            'revenue': reward,
            'frequency': self.grid_frequency
        }
        
        return self.state, reward, terminated, truncated, info
    
    def _calculate_reward(self, action: int, charge_rate: float, discharge_rate: float, bid_multiplier: float) -> float:
        """Calculate reward for current action"""
        reward = 0.0
        
        # Revenue from discharging
        if discharge_rate > 0:
            revenue = discharge_rate * 0.25 * self.power_price * bid_multiplier / 1000
            reward += revenue
        
        # Cost of charging
        if charge_rate > 0:
            cost = charge_rate * 0.25 * self.power_price * 0.8 / 1000  # Buy at lower price
            reward -= cost
        
        # Penalty for extreme SOC
        if self.soc < 20 or self.soc > 90:
            reward -= 10
        
        # Bonus for frequency support
        if self.grid_frequency < 49.9:
            if discharge_rate > 0:  # Discharging helps when frequency is low
                reward += 20
        elif self.grid_frequency > 50.1:
            if charge_rate > 0:  # Charging helps when frequency is high
                reward += 20
        
        # Peak hour bonus
        hour = (self.current_step // 4) % 24
        if 18 <= hour <= 22 and discharge_rate > 0:  # Peak evening hours
            reward += 15
        
        return reward
    
    def _update_dynamics(self):
        """Update grid frequency, price, and demand"""
        # Simulate grid frequency variation
        frequency_noise = np.random.normal(0, 0.05)
        self.grid_frequency = np.clip(49.5 + 0.5 + frequency_noise, 49.5, 50.5)
        
        # Simulate price based on time of day
        hour = (self.current_step // 4) % 24
        if 9 <= hour <= 17:  # Day time
            base_price = 120
        elif 18 <= hour <= 22:  # Peak evening
            base_price = 200
        else:  # Off-peak
            base_price = 80
        
        price_noise = np.random.normal(0, 20)
        self.power_price = np.clip(base_price + price_noise, 50, 300)
        
        # Simulate demand
        demand_noise = np.random.normal(0, 50)
        self.demand = np.clip(500 + demand_noise, 300, 1000)


class RLOptimizer:
    """Reinforcement Learning optimizer for grid bidding strategy"""
    
    def __init__(self):
        # Fix path handling - convert string to Path object
        self.model_path = Path(config.MODEL_SAVE_PATH) / "rl_optimizer"
        self.model_path.mkdir(parents=True, exist_ok=True)  # Create directory if it doesn't exist
        
        self.model = None
        self.env = None
        self.algorithm = config.RL_ALGORITHM
        
        # Action space: 0=hold, 1=charge, 2=discharge, 3=bid_high, 4=bid_low
        self.action_space = spaces.Discrete(5)
        
        # State space: [soc, grid_freq, price, power_output, hour, day_of_week]
        self.observation_space = spaces.Box(
            low=np.array([0, 49.5, 0, 0, 0, 0]),
            high=np.array([100, 50.5, 500, 500, 23, 6]),
            dtype=np.float32
        )
    
    def create_environment(self, historical_data: Optional[Dict] = None) -> gym.Env:
        """Create training environment"""
        self.env = GridBiddingEnv(historical_data=historical_data)
        return self.env
    
    def build_model(self, env: Optional[gym.Env] = None):
        """Build RL model"""
        try:
            if env is None:
                env = self.create_environment()
            
            # Vectorize environment
            vec_env = DummyVecEnv([lambda: env])
            
            if self.algorithm == "PPO":
                self.model = PPO(
                    "MlpPolicy",
                    vec_env,
                    learning_rate=3e-4,
                    n_steps=2048,
                    batch_size=64,
                    n_epochs=10,
                    gamma=0.99,
                    gae_lambda=0.95,
                    clip_range=0.2,
                    verbose=1,
                    tensorboard_log=str(self.model_path / "tensorboard")
                )
            elif self.algorithm == "DQN":
                self.model = DQN(
                    "MlpPolicy",
                    vec_env,
                    learning_rate=1e-3,
                    buffer_size=50000,
                    learning_starts=1000,
                    batch_size=32,
                    gamma=0.99,
                    train_freq=4,
                    target_update_interval=1000,
                    verbose=1,
                    tensorboard_log=str(self.model_path / "tensorboard")
                )
            else:
                raise ValueError(f"Unknown algorithm: {self.algorithm}")
            
            logger.info(f"Built {self.algorithm} model for RL optimization")
            
        except Exception as e:
            logger.error(f"Error building RL model: {e}")
            raise
    
    def train(
        self,
        total_timesteps: int = 100000,
        eval_freq: int = 5000,
        n_eval_episodes: int = 10
    ) -> Dict:
        """
        Train RL model
        
        Args:
            total_timesteps: Total training timesteps
            eval_freq: Evaluation frequency
            n_eval_episodes: Number of evaluation episodes
        
        Returns:
            Training metrics
        """
        try:
            if self.model is None:
                self.build_model()
            
            # Evaluation callback
            eval_env = DummyVecEnv([lambda: self.create_environment()])
            eval_callback = EvalCallback(
                eval_env,
                best_model_save_path=str(self.model_path / "best_model"),
                log_path=str(self.model_path / "eval_logs"),
                eval_freq=eval_freq,
                n_eval_episodes=n_eval_episodes,
                deterministic=True,
                render=False
            )
            
            # Checkpoint callback
            checkpoint_callback = CheckpointCallback(
                save_freq=10000,
                save_path=str(self.model_path / "checkpoints"),
                name_prefix="rl_model"
            )
            
            # Train
            logger.info(f"Starting {self.algorithm} training: {total_timesteps} timesteps")
            self.model.learn(
                total_timesteps=total_timesteps,
                callback=[eval_callback, checkpoint_callback],
                progress_bar=True
            )
            
            # Save final model
            self.save("final")
            
            results = {
                'algorithm': self.algorithm,
                'total_timesteps': total_timesteps,
                'training_completed': True
            }
            
            logger.info(f"RL training completed: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error training RL model: {e}")
            raise
    
    def predict(self, state: np.ndarray, deterministic: bool = True) -> Tuple[int, float]:
        """
        Get action from RL model
        
        Args:
            state: Current state observation
            deterministic: Whether to use deterministic policy
        
        Returns:
            (action, action_probability)
        """
        if self.model is None:
            logger.warning("No model loaded, using random action")
            return np.random.randint(0, 5), 0.2
        
        try:
            action, _states = self.model.predict(state, deterministic=deterministic)
            return int(action), 1.0
        except Exception as e:
            logger.error(f"Error predicting action: {e}")
            return 0, 0.0
    
    def evaluate(self, n_episodes: int = 10) -> Dict:
        """Evaluate model performance"""
        if self.model is None or self.env is None:
            raise ValueError("Model and environment must be initialized")
        
        total_rewards = []
        episode_lengths = []
        
        for _ in range(n_episodes):
            obs, _ = self.env.reset()
            done = False
            episode_reward = 0
            steps = 0
            
            while not done:
                action, _ = self.predict(obs)
                obs, reward, terminated, truncated, _ = self.env.step(action)
                done = terminated or truncated
                episode_reward += reward
                steps += 1
            
            total_rewards.append(episode_reward)
            episode_lengths.append(steps)
        
        return {
            'mean_reward': float(np.mean(total_rewards)),
            'std_reward': float(np.std(total_rewards)),
            'mean_episode_length': float(np.mean(episode_lengths)),
            'n_episodes': n_episodes
        }
    
    def save(self, model_name: str = "latest"):
        """Save trained RL model"""
        try:
            if self.model is None:
                logger.warning("No model to save")
                return
            
            model_file = self.model_path / f"model_{model_name}.zip"
            self.model.save(str(model_file))
            
            logger.info(f"✅ Saved RL model to {model_file}")
        except Exception as e:
            logger.error(f"Error saving RL model: {e}")
    
    def load(self, model_name: str = "latest"):
        """Load trained RL model"""
        try:
            model_file = self.model_path / f"model_{model_name}.zip"
            
            if not model_file.exists():
                raise FileNotFoundError(f"Model file not found: {model_file}")
            
            if self.algorithm == "PPO":
                self.model = PPO.load(str(model_file))
            else:
                self.model = DQN.load(str(model_file))
            
            logger.info(f"✅ Loaded RL model from {model_file}")
        except Exception as e:
            logger.error(f"Error loading RL model: {e}")
            raise