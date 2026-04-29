# Melhorias — FinançaCasal

Backlog completo gerado a partir do feedback recebido em 22/04/2026.
Cada tarefa tem uma descrição do que ela faz e por que existe.

---

## Sprint 1 — Quick Wins
> Melhorias de baixo esforço e alto impacto. Não exigem mudanças de arquitetura.

---

### 1. Perfil do Usuário
> Hoje o app mostra só o email no header e não permite editar nada. O usuário pediu foto, nome e troca de senha.

- [x] **Criar modal de perfil**
  - Janela acessível pelo header com campos: foto, nome de exibição, email (readonly), nova senha
  - Substituir o email cru no header por um avatar clicável

- [x] **Adicionar `display_name` e `avatar_url` na tabela `configuracoes`**
  - Salvos dentro do JSON `userData` no campo `dados` do Supabase
  - Sem nova tabela

- [ ] **Implementar upload de foto via Supabase Storage**
  - _Parcialmente feito: upload converte para base64 e salva no JSON de config (< 500 KB)_
  - Criar bucket `avatars` no Supabase para imagens maiores (futuro)

- [x] **Conectar troca de senha via `supabase.auth.updateUser()`**
  - Implementado com validação de mínimo 6 chars e confirmação

- [x] **Exibir `display_name` e avatar no header**
  - Mostra nome se cadastrado, senão email
  - Avatar com foto ou ícone padrão

- [x] **Salvar `display_name` no `storageService`**
  - Persiste em localStorage via `saveConfig` e no Supabase

---

### 2. Ícone de Ajuda
> O app não tem nenhuma documentação in-app. Usuário novo não sabe como usar as funcionalidades.

- [x] **Criar componente de modal/drawer de ajuda**
  - Drawer lateral que abre ao clicar no ícone `?` no header
  - Animação slide-in, overlay escuro com blur, fecha ao clicar fora

- [x] **Escrever textos explicativos por seção**
  - Dashboard, Planejamento, Lançamentos, Relatórios, Dívidas, Metas, Perfil

- [x] **Tour guiado para primeiro acesso**
  - Tooltip sequencial em 4 passos ao primeiro login
  - Flag `tour_completed` no localStorage para não repetir

---

### 3. Exportar Excel
> Hoje o app só exporta CSV simples. O usuário quer Excel com abas e formatação.

- [x] **Adicionar biblioteca SheetJS via CDN**
  - SheetJS 0.20.3 adicionado ao `index.html`

- [x] **Criar função `exportExcel()` no `ReportsController`**
  - Usa as mesmas transações filtradas por período

- [x] **Montar planilha com múltiplas abas**
  - Aba "Transações": lista completa com colunas formatadas
  - Aba "Por Categoria": totais de receita/despesa/saldo por categoria
  - Aba "Resumo": totais gerais do período

- [x] **Formatar células corretamente**
  - Valores com formato `#,##0.00`
  - Larguras de coluna otimizadas

- [x] **Adicionar botão "Exportar Excel" nos relatórios**
  - Botão verde com ícone de Excel ao lado do CSV

---

### 4. Categorias de Contas (Wallets)
> Hoje todas as carteiras são iguais. O usuário quer distinguir Conta Corrente, Poupança, Investimento, etc.

- [x] **Adicionar campo `tipo` no modelo `Wallet`**
  - `conta_corrente` (default), `poupanca`, `investimento`, `dinheiro`, `outro`

- [x] **Atualizar modal de criação/edição de carteiras**
  - Radio buttons de tipo com emojis no formulário

- [x] **Exibir ícone e tipo na listagem de carteiras**
  - Cada carteira mostra emoji + label do tipo + saldo

- [ ] **Filtrar saldo por tipo no Dashboard**
  - Agrupamento "Total em poupança: R$ X" (futuro)

---

## Sprint 2 — Funcionalidades Core
> Funcionalidades novas que agregam valor direto ao uso diário.

---

### 5. Cadastro de Favorecidos
> O usuário quer saber pra quem pagou. Ex: "Quanto paguei pra Gustavo?" ou "Quanto gastei com Anthropic?". Hoje não há esse vínculo nas transações.

- [x] **Criar modelo `Payee`**
  - Campos: `id`, `nome`, `documento` (CPF/CNPJ, opcional), `categoria_padrao`, `observacoes`
  - Salvar dentro do JSON `configuracoes` (sem nova tabela por enquanto)

- [x] **Criar tela de gerenciamento de favorecidos**
  - CRUD completo: listar, criar, editar, excluir favorecidos
  - Acessível via menu de Configurações ou Planejamento

- [x] **Adicionar campo "Favorecido" no formulário de transação**
  - Input com autocomplete buscando nos favorecidos cadastrados
  - Permitir criar novo favorecido inline (sem sair do formulário)

- [x] **Salvar `payee_id` na tabela `financeiro` do Supabase**
  - Adicionar coluna `payee_id` na tabela (migration SQL necessária)
  - Atualizar `supabaseService` para incluir o campo nas queries

- [ ] **Criar relatório "Por Favorecido"**
  - Na tela de Relatórios, nova seção mostrando total pago/recebido por favorecido
  - Gráfico de barras horizontal com top favorecidos
  - Ao clicar, lista todas as transações vinculadas àquele favorecido

- [ ] **Filtro por favorecido no Dashboard**
  - Adicionar favorecido como opção de filtro na lista de transações

---

### 6. Calendário de Pagamentos
> O usuário quer uma visão de "o que vence quando" para planejar o fluxo. Hoje isso só existe de forma implícita nas contas agendadas.

- [x] **Criar aba "Calendário" na navegação principal**
  - Nova aba no menu principal entre Relatórios e Dívidas
  - Ícone de calendário

- [x] **Implementar grid de calendário mensal**
  - Grid 7 colunas (dias da semana) × 5/6 linhas (semanas)
  - Construído em JS puro, sem bibliotecas externas
  - Navegação prev/next mês

- [x] **Popular o calendário com eventos financeiros**
  - Contas agendadas: aparecem no dia de vencimento
  - Vencimento de cartões: aparece no dia de vencimento de cada cartão
  - Transações já registradas: aparecem na data da transação
  - Código de cores: receita = verde, despesa = vermelho, pendente = amarelo, cartão = roxo

- [ ] **Tooltip ao clicar num dia**
  - Popover mostrando lista de todos os lançamentos do dia
  - Mostrar valor total do dia (positivo ou negativo)
  - Botão de atalho para registrar transação naquela data

- [x] **Visão de lista semanal como alternativa**
  - Toggle entre "grade mensal" e "lista semanal"
  - Lista semanal agrupa por dia e mostra mais detalhes

---

## Sprint 3 — Arquitetura Multi-Usuário
> Esta sprint exige mudanças de arquitetura no banco de dados. Precisa ser planejada com cuidado para não quebrar dados existentes.

---

### 7. Convite Familiar (Co-owner do Workspace)
> Hoje o app é mono-usuário. A Andréa não consegue acessar os mesmos dados. A solução é criar o conceito de "workspace" compartilhado.

- [x] **Criar tabela `workspaces` no Supabase**
  - Campos: `id`, `nome` (ex: "Família Silva"), `owner_id`, `created_at`
  - Cada usuário pertence a um workspace

- [x] **Criar tabela `workspace_members`**
  - Campos: `workspace_id`, `user_id`, `role` (owner/member), `invited_at`, `accepted_at`
  - Permite múltiplos membros por workspace

- [x] **Migrar tabela `financeiro` para incluir `workspace_id`**
  - Todas as transações passam a pertencer a um workspace, não a um usuário individual
  - Migration SQL precisa popular `workspace_id` nos registros existentes

- [x] **Migrar tabela `configuracoes` para `workspace_id`**
  - Orçamentos, cartões, carteiras, metas — tudo compartilhado no workspace

- [x] **Configurar Row Level Security (RLS) no Supabase**
  - Políticas de acesso: usuário só vê dados do workspace ao qual pertence
  - Garantir que nenhum dado vaze entre workspaces diferentes

- [x] **Criar sistema de convite via email**
  - Gerar token de convite com validade de 7 dias
  - Enviar email com link usando Supabase Edge Function ou Supabase Auth Invite
  - Ao aceitar, associar o novo usuário ao workspace

- [x] **Criar tela "Membros" nas configurações**
  - Listar membros atuais do workspace com papel (dono/membro)
  - Input para convidar por email
  - Opção de remover membro

- [x] **Adaptar `AuthController` para carregar workspace correto**
  - Após login, buscar o workspace do usuário
  - Se for novo usuário sem workspace, criar um novo automaticamente
  - Se foi convidado, associar ao workspace do convite

---

### 8. Perfis Gerenciados (Mãe, Filhos, Dependentes)
> Além do casal, o usuário quer gerenciar as finanças de outras pessoas (mãe idosa, filho mais velho). Cada perfil tem seus próprios dados.

- [x] **Criar tabela `managed_profiles`**
  - Campos: `id`, `workspace_id`, `nome`, `relacao` (mãe, filho, etc.), `avatar_url`, `cor` (identificação visual)
  - Vinculado ao workspace, não ao usuário individual

- [x] **Criar tela de gerenciamento de perfis**
  - CRUD de perfis dependentes
  - Acessível via Configurações

- [x] **Implementar seletor de contexto no header**
  - Dropdown no header: "Casal" / "Minha Mãe" / "João (filho)"
  - Ao trocar, recarregar o app com os dados do perfil selecionado
  - Salvar contexto ativo no localStorage

- [x] **Adicionar `profile_id` na tabela `financeiro`**
  - Transações passam a ter um perfil associado (null = casal/padrão)
  - Filtrar todos os dados pelo `profile_id` ativo

- [x] **Criar visão consolidada "Todos os Perfis"**
  - Opção no seletor de contexto para ver tudo junto
  - Dashboard mostra saldo e gastos somados de todos os perfis
  - Identificação visual de qual transação pertence a qual perfil

- [x] **Adaptar relatórios para filtrar por perfil**
  - Dropdown "perfil" nos filtros de relatório
  - Opção "todos" para visão consolidada

---

## Sprint 4 — Features Avançadas
> Funcionalidades mais complexas que requerem mais tempo de desenvolvimento.

---

### 9. Simulador de Fluxo de Caixa
> O usuário quer responder perguntas como: "Se eu comprar um carro parcelado, como fica meu saldo nos próximos 12 meses?" Hoje não há simulação de cenários futuros.

- [x] **Criar aba "Simulador" na navegação**
  - Nova seção dedicada à projeção futura
  - Ícone de gráfico com seta para cima

- [x] **Projetar saldo futuro com dados atuais**
  - Calcular mês a mês: saldo atual + receitas recorrentes − contas agendadas
  - Mostrar projeção para os próximos 12 meses como ponto de partida ("cenário base")

- [x] **Painel de simulação de eventos futuros**
  - Formulário para adicionar evento: nome, tipo (compra, financiamento, receita extra), valor, data de início
  - Para financiamentos: campos de entrada + parcelas + valor mensal
  - Múltiplos eventos podem ser adicionados ao mesmo cenário

- [x] **Gráfico comparativo: base vs. simulação**
  - Linha azul: saldo projetado sem o evento
  - Linha laranja: saldo projetado com o evento
  - Área vermelha abaixo de zero (saldo negativo) destacada

- [x] **Salvar simulações nomeadas**
  - Dar nome ao cenário (ex: "Troca de Carro — Junho")
  - Salvar no JSON de `configuracoes`
  - Carregar e comparar simulações salvas

- [x] **Calcular indicadores do cenário**
  - Mês em que o saldo ficaria negativo (se ficar)
  - Menor saldo no período
  - Tempo para recuperar o saldo inicial

---

### 10. Importação de Extratos Bancários

#### Fase 10a — OFX (sem IA, gratuito)
> OFX é o formato padrão de exportação de extratos da maioria dos bancos brasileiros. É um XML estruturado que pode ser parseado sem IA.

- [x] **Criar parser OFX nativo em JavaScript**
  - OFX é um formato SGML/XML; parsear com regex ou DOMParser
  - Extrair: data, valor, descrição, tipo (débito/crédito), ID da transação
  - Testar com extratos reais de Bradesco, Itaú, Nubank, BB

- [x] **Criar modal de importação com drag & drop**
  - Área de drop de arquivo `.ofx` ou `.qfx`
  - Feedback visual durante o processamento

- [x] **Tela de revisão antes de confirmar**
  - Mostrar lista de transações extraídas com checkbox
  - Permitir editar categoria e favorecido antes de importar
  - Destacar possíveis duplicatas (mesma data + valor já existe no banco)

- [x] **Detecção de duplicatas**
  - Antes de inserir, checar se já existe transação com mesmo valor + data + descrição similar
  - Marcar como "possível duplicata" e pedir confirmação do usuário

- [x] **Inserção em batch no Supabase**
  - Enviar todas as transações aprovadas de uma vez
  - Mostrar progresso e resultado final (X inseridas, Y duplicatas ignoradas)

#### Fase 10b — PDF com Claude API
> Extratos em PDF não têm estrutura garantida. A Claude API consegue ler o texto do PDF e extrair as transações em formato JSON estruturado.

- [ ] **Criar Supabase Edge Function para processar PDF**
  - Recebe o arquivo PDF via upload
  - Extrai o texto do PDF (biblioteca `pdf-parse` ou similar no Deno)
  - Envia o texto para a Claude API com prompt estruturado

- [ ] **Escrever prompt para extração de transações**
  - Pedir ao Claude para retornar JSON com array de transações
  - Campos: data, descrição, valor, tipo (débito/crédito)
  - Incluir exemplos de layouts de bancos diferentes no prompt (few-shot)

- [ ] **Tratar variações de layout por banco**
  - Nubank, Bradesco, Itaú, BB, Caixa, Inter têm formatos diferentes
  - O prompt deve ser robusto o suficiente para lidar com variações
  - Testar e iterar com extratos reais

- [ ] **Integrar resposta da Edge Function ao frontend**
  - Retornar a lista de transações extraídas para o modal de revisão (mesmo da fase 10a)
  - Reutilizar toda a lógica de revisão, duplicatas e inserção em batch

- [ ] **Adicionar seletor de tipo no modal de importação**
  - Toggle: "Arquivo OFX" ou "Extrato PDF"
  - Dependendo da seleção, usar o parser OFX ou chamar a Edge Function

---

## Tarefas Transversais
> Estas tarefas acompanham todas as sprints e devem ser feitas junto com as mudanças.

- [ ] **Escrever migrations SQL para cada mudança de schema**
  - Sempre que uma coluna ou tabela nova for criada no Supabase, documentar o SQL
  - Manter um arquivo `migrations/` com os scripts em ordem cronológica

- [ ] **Atualizar tipos TypeScript após cada migration**
  - Rodar `supabase gen types typescript` para regenerar os tipos
  - Manter `src/types/supabase.ts` atualizado

- [ ] **Criar testes para cada novo módulo**
  - Adicionar casos no `tests/runner.js` existente
  - Cobrir pelo menos: criação, edição, exclusão e validação de cada nova entidade

- [ ] **Atualizar o ícone de ajuda a cada sprint**
  - Sempre que uma feature nova for entregue, adicionar sua explicação no drawer de ajuda
  - Não deixar feature nova sem documentação in-app

---

## Resumo do Backlog

| Sprint | Features | Tarefas | Prioridade |
|--------|----------|---------|-----------|
| 1 | Perfil, Ajuda, Excel, Categorias de Conta | ~20 | Alta |
| 2 | Favorecidos, Calendário | ~13 | Alta |
| 3 | Convite Familiar, Perfis Gerenciados | ~15 | Média |
| 4 | Simulador de Fluxo, Importação OFX/PDF | ~18 | Média/Baixa |
| **Total** | **10 features** | **~66 tarefas** | — |

---

*Gerado em 22/04/2026 com base no feedback de Borbão.*
