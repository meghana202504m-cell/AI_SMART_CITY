"""Train a simple traffic congestion model and save it to disk."""
import os
import pickle
import numpy as np
from sklearn.linear_model import LinearRegression

MODEL_PATH = os.path.join(os.path.dirname(__file__), "traffic_model.pkl")


def generate_dummy_data(n_samples=500):
    rng = np.random.default_rng(42)
    hours = rng.integers(0, 24, size=n_samples)
    weather = rng.integers(1, 4, size=n_samples)
    day_of_week = rng.integers(0, 7, size=n_samples)

    # Congestion signal: high during rush hours, bad weather, work days
    congestion = (
        2.5 * hours
        + 15 * (weather / 3.0)
        + 7 * day_of_week
        + rng.normal(0, 10, size=n_samples)
    )
    congestion = np.clip(congestion, 0, 100)
    X = np.column_stack([hours, weather, day_of_week])
    y = congestion
    return X, y


def train_and_save_model():
    X, y = generate_dummy_data()
    model = LinearRegression()
    model.fit(X, y)

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    print("Trained model saved at", MODEL_PATH)


if __name__ == "__main__":
    train_and_save_model()
