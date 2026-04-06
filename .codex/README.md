# Codex MCP Setup

Bu klasor OpenAI Codex dokumantasyonundaki proje-scoped MCP yapisini uygular.

Temel kaynaklar:
- Codex MCP: https://developers.openai.com/codex/mcp
- Codex Config Reference: https://developers.openai.com/codex/config-reference

## Bu repoda ne kuruldu

1. `.codex/config.toml`
   Trusted project oldugunda Codex tarafindan okunacak proje-scoped MCP config.

2. `openaiDeveloperDocs`
   Resmi OpenAI Docs MCP server'i aktif edildi.

## Neyi bilerek MCP olarak kurmadim

- `filesystem`
- `git`

Bunlar OpenAI Codex dokumantasyonundaki MCP server kategorisinden farklidir. Yerel arac/shell katmaninda kullanilirlar; `.codex/config.toml` icine MCP server olarak yazilmazlar.

## Neden GitHub / Render / Netlify / Playwright aktif degil

OpenAI dokumantasyonu MCP config formatini net veriyor:
- STDIO server icin `command` ve opsiyonel `args`
- HTTP server icin `url` ve opsiyonel `bearer_token_env_var`

Ancak GitHub, Render, Netlify ve Playwright icin gercek MCP server URL veya stdio komutu vendor tarafindan dogrulanmadan yazilmaz. Sahte veya tahmini endpoint yazmak istemedim.

## Credential notu

Token'lar root `.env` dosyanda tutuluyor. Bir HTTP MCP server bearer token ile calisacaksa config'te ilgili env adi kullanilir.
Ornek:
- `GITHUB_TOKEN`
- `NETLIFY_AUTH_TOKEN`
- `RENDER_API_KEY`

## Sonraki dogru adim

Vendor MCP server URL veya stdio komutunu netlestirdigimiz anda `.codex/config.toml` icine aktif server olarak eklerim ve `codex mcp list` ile dogrularim.
