from app import worker


def test_module_imports():
    assert worker is not None


def test_batch_size_is_positive():
    from app import settings
    assert settings.BATCH_SIZE > 0
