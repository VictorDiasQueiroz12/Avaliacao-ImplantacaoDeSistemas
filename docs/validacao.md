# Registro técnico de validação

Data: 15/11/2026 (America/Sao_Paulo). Versão: 1.0.0.

> Atualização posterior, em 15/11/2026: Docker instalado e executado pelo solicitante. A revisão para a ficha RDM confirmou containers e logs de inicialização da aplicação e do PostgreSQL 17.12. O banco ficou pronto às 20h38 e a aplicação iniciou às 20h38min05s (Brasília); ambos foram encerrados às 20h39 com código 0. A porta 3000 estava configurada para publicação e o banco não tinha portas publicadas. Os containers estavam parados na revisão. Não foi repetido o fluxo HTTP nem verificada persistência após reinício dos containers nesta revisão. As observações de Docker ausente abaixo descrevem o ambiente da primeira validação.

## Ambiente observado

- Projeto inicialmente vazio; sem base anterior para reaproveitar.
- Node.js 26.13.1 e npm 11.20.0 disponíveis; `npm.cmd` utilizado por bloqueio de `npm.ps1`.
- PostgreSQL 18.7 instalado. Cluster exclusivo criado em `tmp/pgdata`, ouvindo apenas `127.0.0.1:55432`.
- Bancos separados `estulanches` (demonstração HTTP) e `estulanches_test` (testes).
- Microsoft Edge disponível para testes reais de navegador.
- Docker/Compose ausentes do PATH; executável padrão do Docker Desktop também ausente.

## Resultados

- 33 testes unitários aprovados.
- 6 testes de integração aprovados com PostgreSQL real, incluindo falha induzida no segundo item e rollback completo.
- 1 teste de navegador aprovado: cadastro, carrinho, histórico, erros, lista vazia e larguras de 1440, 1024, 768, 390 e 320 px.
- Fluxo HTTP de cadastro, pedido, consulta e rejeição de produto inexistente aprovado pelo script `test:e2e`.
- Aplicação e PostgreSQL locais reiniciados preservando `tmp/pgdata`; `test:e2e -- --verify` confirmou o pedido #1 completo e seu total de 1.470 centavos após o reinício.
- Processos temporários da aplicação e do banco encerrados após as verificações. Dados locais preservados em `tmp/pgdata`; não são incluídos no Git ou na imagem Docker.
- Instalação limpa a partir do lockfile executada com `npm.cmd ci --offline --ignore-scripts`; todos os 40 testes (33 unitários, 6 de integração e 1 de navegador) passaram novamente depois dessa instalação.
- Análise estática de sintaxe dos scripts Node e do JavaScript da interface aprovada.
- Copy lint da interface: 0 FAIL e 0 WARN.
- Capturas de 1440 px e 390 px geradas com Edge headless e inspecionadas visualmente: sem cortes ou sobreposição no cardápio. Arquivos temporários em `shots/` (ignorados pelo Git).
- Instalação de dependências auditada pelo npm sem vulnerabilidades reportadas.

## Limites e reprodução

O Docker não está instalado neste ambiente. Portanto **não foi executado** `docker compose up --build -d`, nem inspecionados estado/portas/logs de containers, nem comprovada persistência no volume Docker ou execução na imagem Node 24/PostgreSQL 17. Os resultados locais não substituem essa validação.

O README contém todos os comandos de inicialização limpa, testes em projeto Docker separado, inspeção de serviços/logs e validação do pedido após `docker compose restart` sem apagar o volume.

O gate visual da skill retornou `GATE: ERROR`: autodetecção não encontrou Chrome e a URL ainda não estava servindo durante aquela chamada. Conforme a regra da skill, o gate não foi repetido. A validação funcional de navegador posterior usou Edge explicitamente. As receitas de landing page da skill não foram aplicadas ao fluxo operacional solicitado; a decisão está documentada em `docs/interface.md`.
