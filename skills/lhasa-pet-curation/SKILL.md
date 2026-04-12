---
name: lhasa-pet-curation
description: >-
  维护 lhasasa-tashidelek-web 宠物电商：选品扩充 data/products.json、对标头部宠物站类目结构、
  配合 Web Search 与 read/write/exec；支付走独立站点的 Airwallex Intent API，勿把 API Key 写入本仓库。
---

# Lhasa Sa 宠物馆 · 选品与商品表维护

## 何时使用

- 用户要「上新、调价、下架、对标波奇/ Chewy / 天猫宠物类目」；
- 需要批量编辑 `data/products.json` 或同步留言墙 `data/guestbook.json`（审核后展示）；
- 与 OpenClaw 的 **read / write / exec**、**Web Search**、**Browser**（若启用）组合使用。

## 头部宠物站常见类目（对齐结构）

1. **主粮零食**：干粮/湿粮/冻干/磨牙棒（犬猫分开展示可用 `category` 前缀如 `猫·` `犬·`）。
2. **医疗保健**：驱虫、维生素、关节护理、处方粮咨询引导线下兽医。
3. **清洁美容**：香波、护毛、指甲剪、湿巾、尿垫。
4. **日用耗材**：猫砂、拾便袋、替换滤芯。
5. **智能用品**：饮水机、喂食器、摄像头（注明 App/联网）。
6. **出行装备**：航空箱、胸背、车载垫。
7. **玩具训练**：互动玩具、嗅闻垫、训练响片。
8. **水族小宠**：鱼缸用品、兔鼠粮（若经营）。

## 商品 JSON 字段约定（勿改键名，以免前端坏掉）

每条 SKU 须含：

- `id`：稳定英文 slug，如 `pet-xxx-yyy`
- `name`、`category`、`price`（人民币 **元**，整数或一位小数）
- `subtitle`：规格/卖点一行
- `badge`：字符串或 `null`（如「热销」「新品」）

## 推荐工作流（可写进 Cron + 对话）

1. **情报**：Web Search 本周「宠物 零食 趋势」「猫砂 新品」等（遵守站点 robots 与法律）。
2. **归纳**：列出 5–10 个候选 SKU + 建议价带 + 理由。
3. **写入**：用 **write** 更新 `data/products.json`（保持合法 JSON，先备份或 git diff）。
4. **验证**：本地或 `exec` 运行 `node -e "JSON.parse(require('fs').readFileSync('data/products.json'))"`。
5. **部署**：`git commit` + `git push`（Vercel 自动构建）。

## 禁止事项

- 勿在 `payment-config.js` 或任何前端文件写入 **Airwallex API Key**。
- 勿虚构「已支付」；支付结果以空中云汇 Webhook + 后台为准。
- 留言 **公开展示** 仅放审核后的条目到 `data/guestbook.json`；用户新留言走 `/api/guestbook` + Webhook。

## 仓库路径（Windows 示例）

`C:\Users\Administrator\lhasasa-tashidelek-web`

安装到 OpenClaw：将本目录复制到工作区 `skills/lhasa-pet-curation/`，或通过 ClawHub/本地 skill 路径加载（以你当前 OpenClaw 版本文档为准）。
