# 川麻记分（Sichuan Mahjong scorer）

血战到底算番 + 记筹码。多人房间实时同步（3 秒轮询），每把可记多人胡牌、刮风下雨、查叫/花猪，可以拍照识牌自动算番。

## 功能
- **房间**：开房得到 5 位房间号，发链接给牌友，输入名字加入（同名可在别的手机接着记）。
- **每把记账**：胡牌（自摸/点炮、谁付钱）、杠（直杠 2 底 / 巴杠每家 1 底 / 暗杠每家 2 底）、查叫/查花猪/退税等转账。
- **番型**：平胡 0、对对胡 1、七对 2、带幺九 2、金钩钓 2、将对 3、将金钩钓 4；清一色 +2；根 +1/个；杠上花、杠上炮、抢杠胡、海底捞月、海底炮 +1；天胡/地胡 +5；门清/中张（可选规则）+1。
- **计分**：每家付 = 底分 × 2^番（封顶），自摸加底或加番可选。规则改动只影响之后的把数。
- **结算**：自动算出最少转账方案。
- **算番器 / 拍照**：拍一手牌 → Claude 识别牌面 → 本地程序判断胡没胡、几番；13 张时列出听哪些牌、各几番。识别结果可以手动改。

## 部署到 Vercel
1. 在 Vercel 导入这个 GitHub 仓库，**Root Directory 选 `sichuan-mahjong`**（框架自动识别为 Next.js）。
2. 项目 → Storage → 添加 **Upstash for Redis**（Marketplace，免费档即可），会自动注入 `KV_REST_API_URL` / `KV_REST_API_TOKEN`（或 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`）。不配的话房间数据只在内存里，会丢。
3. Settings → Environment Variables 加 `ANTHROPIC_API_KEY`（拍照识牌用，不配则只能手动选牌）。
4. Redeploy。

## 本地开发
```bash
npm install
npm run dev     # 没配 Redis 时用内存存储
npm test        # 牌型/计分单元测试
```
