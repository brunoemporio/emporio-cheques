# Controle de Cheques

Sistema para lançar cheques enviados a fornecedores, com autocomplete, filtros, exportação CSV e relatório diário em PDF.

## Como rodar localmente

1. Instale as dependências:

```bash
npm install
```

2. Rode o projeto:

```bash
npm run dev
```

3. Abra o endereço mostrado no terminal.

## Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode o arquivo `supabase/schema.sql`.
4. Copie `.env.example` para `.env`.
5. Preencha:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Sem essas chaves, o app funciona em modo local no navegador.

## Vercel

1. Envie este projeto para o GitHub.
2. Importe o repositório na Vercel.
3. Configure as variáveis:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

4. Faça o deploy.
