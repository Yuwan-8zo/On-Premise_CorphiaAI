# 不能用 bind mount 把這個資料夾的設定檔掛進容器：這台機器的 D 槽是隨身碟（exFAT，抽取式），
# WSL2／Docker Desktop 的 drvfs 橋接對這種磁碟不穩定（實測：VM 裡的 mount 清單完全看不到 D 槽，
# 不管 Docker Desktop 的「File sharing」設定怎麼調都一樣），掛了也讀不到最新內容。
# 改成 build time 直接把設定檔「燒」進 image：改了設定要重新 build 才會生效
#   docker compose --profile search build searxng
FROM searxng/searxng:latest
COPY settings.yml /etc/searxng/settings.yml
COPY limiter.toml /etc/searxng/limiter.toml
