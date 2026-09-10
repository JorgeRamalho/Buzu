# Buzzu

Portal de mobilidade urbana de Curitiba com frontend estático e API Node.js sem dependências externas.

## Estrutura

```text
src/
	client/             Recursos da interface estática
		scripts/          JavaScript do navegador
		styles/           Folhas de estilo
	server/             API e servidor HTTP
index.html             Entrada principal do frontend
data/                 Dados locais persistidos (não públicos)
```

A raiz contém a entrada principal, arquivos de configuração e documentação. O servidor serve `index.html` pela raiz, expõe os estilos e scripts organizados em `src/client`, e mantém os dados de usuários em `data`.

## Executar

Requer Node.js 20 ou superior.

```powershell
Copy-Item .env.example .env
npm start
```

Abra `http://localhost:3000`.

## Integrações

- `GET /api/transit/status`: tenta consultar `URBS_REALTIME_URL`; sem URL configurada retorna dados de demonstração identificados como `demo`.
- `GET /api/transit/lines`: tenta consultar `URBS_SCHEDULE_URL`.
- `POST /api/auth/register` e `POST /api/auth/login`: autenticação com hash `scrypt` e token assinado pelo servidor.
- `GET /api/card/balance`: contrato para saldo do Cartão Transporte; não inventa saldo real sem integração autorizada.
- `POST /api/payments/checkout`: cria uma sessão de pagamento. O modo `mock` é local; em produção deve usar um provedor como Mercado Pago/Stripe e webhook verificado.

A URBS precisa fornecer endpoint, formato, autorização de uso e limites de consumo. O portal oficial consultado oferece horários, Cartão Transporte e boletins, mas não apresenta uma API pública anônima para esses dados. Não use scraping como integração de produção.

## Próximas etapas de produção

1. Solicitar à URBS acesso formal aos dados de horários, veículos, pontos e previsões.
2. Trocar o armazenamento JSON local por PostgreSQL/Redis.
3. Configurar HTTPS, CORS restrito, rate limit, logs e rotação de segredos.
4. Configurar provedor de pagamento e validar webhooks antes de creditar qualquer recarga.
5. Implementar LGPD: consentimento, exportação, exclusão e política de retenção.
