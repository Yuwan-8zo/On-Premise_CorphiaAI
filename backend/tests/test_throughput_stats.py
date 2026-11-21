"""打字速度統計：太短的生成不能把速度灌成 1000000 字/秒"""
from app.services.llm_service import LLMService


def _svc():
    return LLMService.__new__(LLMService)


def _init(svc):
    from collections import deque
    svc._recent_runs = deque(maxlen=10)
    svc._last_tokens_per_sec = 0.0
    svc._total_tokens_generated = 0
    svc._total_generations = 0
    return svc


def test_one_token_with_tiny_time_is_ignored():
    svc = _init(_svc())
    svc.record_generation(1, 0.000001)  # 引擎回報 predicted_n=1, predicted_ms=0.001
    stats = svc.get_throughput_stats()
    assert stats["last_tokens_per_sec"] == 0.0
    assert stats["sample_size"] == 0


def test_normal_generation_is_recorded():
    svc = _init(_svc())
    svc.record_generation(200, 10.0)
    stats = svc.get_throughput_stats()
    assert stats["last_tokens_per_sec"] == 20.0
    assert stats["avg_tokens_per_sec"] == 20.0


def test_short_burst_does_not_override_last_real_speed():
    svc = _init(_svc())
    svc.record_generation(200, 10.0)
    svc.record_generation(1, 0.000001)
    assert svc.get_throughput_stats()["last_tokens_per_sec"] == 20.0


def test_short_generation_still_counts_in_totals():
    svc = _init(_svc())
    svc.record_generation(200, 10.0)
    svc.record_generation(3, 0.01)
    stats = svc.get_throughput_stats()
    assert stats["total_generations"] == 2
    assert stats["total_tokens_generated"] == 203
    assert stats["sample_size"] == 1
    assert stats["last_tokens_per_sec"] == 20.0
