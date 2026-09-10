# Arquitetura do Buzzu

## Objetivo

Manter o portal de mobilidade organizado por responsabilidade, com uma raiz enxuta e uma separação clara entre interface pública, servidor e dados persistidos.

## Estrutura

```text
Projeto-Buzu/
├── data/                  Dados locais persistidos; nunca são servidos ao navegador
├── docs/                  Decisões e documentação técnica
├── index.html             Entrada principal do frontend
├── src/
│   ├── client/            Recursos da aplicação entregues ao navegador
│   │   ├── scripts/       Comportamentos e integrações do frontend
│   │   └── styles/        Estilos separados por responsabilidade visual
│   └── server/            API HTTP, autenticação e servidor de arquivos
├── .env.example           Modelo de variáveis locais
├── .gitignore             Regras de arquivos não versionados
├── package.json           Metadados e comandos do projeto
└── README.md              Guia rápido e visão geral
```

## Fluxo de execução

1. `npm start` inicia `src/server/server.js`.
2. O servidor carrega `.env` a partir da raiz do projeto.
3. Rotas iniciadas por `/api/` são processadas pela API.
4. A rota `/` entrega `index.html`; os demais recursos públicos são resolvidos somente dentro de `src/client`.
5. Usuários são persistidos em `data/users.json`, que não faz parte da área pública.

## Regras de organização

- Código do navegador fica em `src/client`.
- Código da API e do servidor fica em `src/server`.
- Dados gerados ou persistidos ficam em `data`.
- Documentação técnica fica em `docs`.
- A raiz recebe apenas configuração, comandos, documentação de entrada e arquivos de controle.
- Novas integrações externas devem ser encapsuladas no servidor e configuradas por variáveis de ambiente.

## Próxima evolução

- Separar rotas da API, autenticação e persistência em módulos dentro de `src/server` quando o volume de código justificar.
- Substituir o JSON local por um banco de dados com migrações.
- Adicionar testes de contrato para endpoints e testes de fumaça para a entrega do frontend.
- Formalizar observabilidade, limites de requisição e políticas de retenção antes de produção.
