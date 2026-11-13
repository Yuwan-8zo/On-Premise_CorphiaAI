"""
給手機連線用的本機 IP（system_monitor._detect_lan_ips）

背景：2026-11-13 使用者回報手機掃 QR code 連不上，查出來電腦本身沒有問題（Vite 有聽所有網卡、
區網開關也開著、防火牆也放行），真正的原因是公司 Wi-Fi 的用戶端隔離（跟這支程式無關）。
但追查過程中發現一個真的漏洞：`_default_route_ip()` 問作業系統「預設路由用哪張網卡」時，
完全沒有檢查那張網卡是不是虛擬網卡（WSL、Hyper-V、Docker Desktop 的虛擬網卡，metric 可能比
實體網卡低，導致作業系統誤答成它）——這張虛擬網卡只存在電腦內部，手機連不到。
第二層「掃全部網卡」的備援路徑本來就有排除虛擬網卡，但只有在「完全沒有預設路由」時才會跑到，
不會因為預設路由指到虛擬網卡而被觸發。這裡補上這一關。
"""

from unittest.mock import MagicMock, patch

from app.api import system_monitor as sm


def _nic(address: str) -> MagicMock:
    addr = MagicMock()
    addr.family = sm.socket.AF_INET
    addr.address = address
    return addr


def _patched_psutil(if_addrs: dict, if_stats: dict):
    """回傳一個 patch context：psutil.net_if_addrs()／net_if_stats() 回傳指定的假資料"""
    mock_psutil = MagicMock()
    mock_psutil.net_if_addrs.return_value = if_addrs
    mock_psutil.net_if_stats.return_value = if_stats
    return patch.dict("sys.modules", {"psutil": mock_psutil})


class TestOwningNicName:
    def test_finds_the_interface_that_owns_the_ip(self):
        with _patched_psutil({"Wi-Fi": [_nic("172.17.198.171")], "vEthernet (WSL)": [_nic("172.26.0.1")]}, {}):
            assert sm._owning_nic_name("172.17.198.171") == "Wi-Fi"
            assert sm._owning_nic_name("172.26.0.1") == "vEthernet (WSL)"

    def test_unknown_ip_returns_none(self):
        with _patched_psutil({"Wi-Fi": [_nic("172.17.198.171")]}, {}):
            assert sm._owning_nic_name("10.0.0.99") is None

    def test_psutil_unavailable_returns_none_not_an_error(self):
        with patch.dict("sys.modules", {"psutil": None}):
            assert sm._owning_nic_name("172.17.198.171") is None


class TestDetectLanIpsTrustsDefaultRouteWhenReal:
    """一般情況（預設路由指到真正的實體網卡）：照舊直接用，不用掃全部網卡"""

    def test_normal_wifi_adapter(self):
        with patch.object(sm, "_default_route_ip", return_value="172.17.198.171"), \
             _patched_psutil({"Wi-Fi": [_nic("172.17.198.171")]}, {}):
            assert sm._detect_lan_ips() == ["172.17.198.171"]

    def test_psutil_unavailable_still_trusts_default_route(self):
        """psutil 不能用（查不到那是哪張網卡）：不能因此就不信任預設路由，寧可照舊回傳，好過完全查不到"""
        with patch.object(sm, "_default_route_ip", return_value="192.168.1.50"), \
             patch.dict("sys.modules", {"psutil": None}):
            assert sm._detect_lan_ips() == ["192.168.1.50"]


class TestDetectLanIpsRejectsVirtualDefaultRoute:
    """預設路由指到虛擬網卡（Docker／WSL／Hyper-V 的 metric 比實體網卡低）：不能照單全收，要改用網卡清單重新挑"""

    def test_docker_or_wsl_hijacked_route_falls_back_to_real_nic(self):
        if_addrs = {
            "vEthernet (WSL)": [_nic("172.26.112.1")],   # 作業系統誤答成這張（只存在電腦內部）
            "Wi-Fi": [_nic("172.17.198.171")],            # 手機實際連得到的那張
        }
        if_stats = {"vEthernet (WSL)": MagicMock(isup=True), "Wi-Fi": MagicMock(isup=True)}
        with patch.object(sm, "_default_route_ip", return_value="172.26.112.1"), \
             _patched_psutil(if_addrs, if_stats):
            assert sm._detect_lan_ips() == ["172.17.198.171"]

    def test_virtual_keyword_matching_is_case_insensitive(self):
        if_addrs = {"Docker vEthernet": [_nic("172.17.0.1")], "Ethernet": [_nic("10.0.0.5")]}
        if_stats = {"Docker vEthernet": MagicMock(isup=True), "Ethernet": MagicMock(isup=True)}
        with patch.object(sm, "_default_route_ip", return_value="172.17.0.1"), \
             _patched_psutil(if_addrs, if_stats):
            assert sm._detect_lan_ips() == ["10.0.0.5"]

    def test_no_real_nic_left_after_rejecting_virtual_one_returns_empty(self):
        """虛擬網卡被排除、又找不到其他真實網卡：寧可回空的，也不要給一個手機連不到的位址"""
        if_addrs = {"vEthernet (WSL)": [_nic("172.26.112.1")]}
        if_stats = {"vEthernet (WSL)": MagicMock(isup=True)}
        with patch.object(sm, "_default_route_ip", return_value="172.26.112.1"), \
             _patched_psutil(if_addrs, if_stats):
            assert sm._detect_lan_ips() == []


class TestDetectLanIpsNoDefaultRoute:
    """沒有預設路由（例如沒有路由器的封閉網路）：直接掃網卡，內網網段優先"""

    def test_prefers_private_network_ranges(self):
        if_addrs = {
            "Ethernet": [_nic("192.168.1.20")],
            "vEthernet (Docker)": [_nic("172.17.0.1")],   # 虛擬網卡：排除
            "Link-local": [_nic("169.254.1.2")],           # 自動配置：排除
        }
        if_stats = {k: MagicMock(isup=True) for k in if_addrs}
        with patch.object(sm, "_default_route_ip", return_value=None), \
             _patched_psutil(if_addrs, if_stats):
            assert sm._detect_lan_ips() == ["192.168.1.20"]

    def test_down_interface_is_excluded(self):
        if_addrs = {"Ethernet": [_nic("192.168.1.20")]}
        if_stats = {"Ethernet": MagicMock(isup=False)}
        with patch.object(sm, "_default_route_ip", return_value=None), \
             _patched_psutil(if_addrs, if_stats):
            assert sm._detect_lan_ips() == []
