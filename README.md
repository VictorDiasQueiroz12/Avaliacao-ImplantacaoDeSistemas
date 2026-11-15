# EstuLanches

Sistema web de cardápio e pedidos para cantina escolar. Interface em português do Brasil, responsiva, com cadastro e busca de produtos, carrinho com quantidades e remoção, confirmação e histórico paginado. Express serve a interface e a API na **mesma porta**.

## Iniciar com Docker no PowerShell

Pré-requisitos: Docker Desktop com Docker Compose v2, engine de containers Linux iniciada. Não é necessário instalar Node nem PostgreSQL no host para executar a aplicação ou os testes via Docker.

Na pasta do projeto:

```powershell
Copy-Item .env.example .env
notepad .env
```

Troque `POSTGRES_PASSWORD` no `.env`. `POSTGRES_USER` e `POSTGRES_DB` definem a conta e o banco iniciais. `PORT` define a porta HTTP no host (padrão `3000`). O Compose passa os parâmetros PostgreSQL individualmente para a aplicação, portanto a senha não precisa ser codificada como URL nesse modo. `DATABASE_URL` e `TEST_DATABASE_URL` são usados na execução local com Node; não são usados pelo serviço `app` do Compose. Não publique o `.env`.

```powershell
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 app db
Start-Process http://localhost:3000
```

Abra **http://localhost:3000** (ajuste se alterar `PORT`). Aguarde `db` e `app` ficarem `healthy`. O banco tem healthcheck e a aplicação inicia depois que ele está pronto. Antes de abrir o HTTP, a aplicação executa as migrações e cria seis produtos fictícios. A tabela `schema_migrations` impede repetir a carga a cada reinício, e um advisory lock impede que duas instâncias inicializem o esquema simultaneamente.

Somente `app` publica porta: `3000/tcp` no container, mapeada para `PORT` no host. O banco **não publica porta no host** e é acessado em `db:5432` pela rede interna do Compose. `docker compose ps` pode mostrar `5432/tcp` como porta interna, sem mapeamento `0.0.0.0:...->5432`.

O volume nomeado `postgres_data` mantém os dados. Alterar usuário, senha ou nome do banco no `.env` **não reconfigura um banco que já foi inicializado no volume**; nesse caso, atualize as credenciais no PostgreSQL e alinhe o `.env`. A aplicação executa como usuário `node`, com `NODE_ENV=production` e apenas dependências de produção.

## Conferir fluxo e persistência

Pela interface: cadastre um produto, abra Novo pedido, adicione itens, ajuste quantidades, remova um item, confirme e consulte o Histórico. O total mostrado após a confirmação é o calculado pelo servidor.

Para repetir pela API no PowerShell (cria dados de validação):

```powershell
$base = 'http://localhost:3000'
Invoke-RestMethod "$base/api/health"
$produtoJson = @{ name = 'Lanche de validação'; description = 'Produto de teste'; priceCents = 735 } | ConvertTo-Json
$produto = Invoke-RestMethod "$base/api/products" -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($produtoJson))
$pedidoJson = @{ totalCents = 1; items = @(@{ productId = $produto.id; quantity = 2; unitPriceCents = 1 }) } | ConvertTo-Json -Depth 5
$pedido = Invoke-RestMethod "$base/api/orders" -Method Post -ContentType 'application/json' -Body $pedidoJson
if ($pedido.totalCents -ne 1470) { throw 'Total oficial incorreto' }
Invoke-RestMethod "$base/api/orders/$($pedido.id)"
Invoke-RestMethod "$base/api/orders"

# Não remova o volume. Mantenha esta sessão PowerShell e a variável $pedido.
docker compose restart
docker compose ps
# Aguarde a aplicação voltar a healthy antes de continuar.
$salvo = Invoke-RestMethod "$base/api/orders/$($pedido.id)"
if ($salvo.totalCents -ne $pedido.totalCents) { throw 'Persistência não confirmada' }
$salvo | ConvertTo-Json -Depth 5
docker compose logs --tail=100 app db
```

`docker compose down` para os serviços e preserva o volume; `docker compose up -d` os inicia de novo. **`docker compose down -v` apaga os dados**; use apenas se quiser limpar o ambiente. Para atualizar a imagem: `docker compose up --build -d`.

Com Node instalado, há também um script HTTP que salva a referência do pedido em `tmp/persistence-check.json`:

```powershell
npm.cmd ci
npm.cmd run test:e2e
docker compose restart
# Depois de app ficar healthy:
npm.cmd run test:e2e -- --verify
```

Use `$env:BASE_URL='http://localhost:OUTRA_PORTA'` se necessário. O script normal cria um produto e um pedido, verifica a consulta e a rejeição de produto inexistente. `--verify` consulta e compara o pedido anterior inteiro, inclusive itens e data.

## Testes

### Com Docker (banco separado, sem porta publicada)

```powershell
docker compose -p estulanches-tests -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from tests
docker compose -p estulanches-tests -f docker-compose.test.yml logs --tail=100
docker compose -p estulanches-tests -f docker-compose.test.yml down -v
```

Esse projeto de testes usa `estulanches_test`, credenciais próprias e armazenamento temporário em memória. Não usa o volume do banco da aplicação. A saída deve indicar 33 testes unitários e 6 de integração aprovados. O teste de rollback causa propositalmente uma exceção no PostgreSQL; essa mensagem no log do **banco de testes** é esperada. Testes de navegador são executados separadamente em um host com navegador instalado.

### Com Node e PostgreSQL locais

Pré-requisitos: Node.js **24 LTS recomendado**, npm e PostgreSQL 17 ou superior. Execute os comandos com `npm.cmd` no PowerShell para evitar bloqueio de `npm.ps1` pela política de execução.

Crie bancos distintos (com uma conta PostgreSQL que tenha permissão, usando `psql` ou pgAdmin):

```sql
CREATE USER estulanches WITH PASSWORD 'troque_esta_senha_local';
CREATE DATABASE estulanches OWNER estulanches;
CREATE DATABASE estulanches_test OWNER estulanches;
```

Copie `.env.example` para `.env` e ajuste `DATABASE_URL` e `TEST_DATABASE_URL`. Em URLs, caracteres especiais na senha devem ser codificados como percent encoding. No modo local use a porta do seu PostgreSQL, normalmente `5432`; o banco do Compose não é publicado no host.

```powershell
npm.cmd ci
npm.cmd run db:init
npm.cmd start
# Ou, para desenvolvimento com reinício automático:
npm.cmd run dev
```

`start` já inicializa o esquema e o seed; `db:init` permite executar apenas essa etapa.

Em outro terminal, na mesma pasta:

```powershell
npm.cmd test
npm.cmd run test:integration
# Ou os dois:
npm.cmd run test:all
```

**O teste de integração limpa produtos, pedidos e itens do banco de testes.** Exige `TEST_DATABASE_URL`, recusa banco cujo nome não termine com `_test` e recusa o mesmo banco configurado em `DATABASE_URL`. Use um banco exclusivo de testes; não execute duas suítes de integração ao mesmo tempo nesse banco.

Os testes verificam validações, centavos exatos, limites, preço oficial independente do navegador, produto inexistente, snapshot de preço e nome, respostas de erro, consultas parametrizadas, migrações idempotentes e reconexão. Um trigger temporário faz a segunda inserção de item falhar para provar que a transação desfaz tanto o pedido quanto o primeiro item.

### Navegador

```powershell
# Primeiro execute a integração; não rode em paralelo no mesmo banco.
npm.cmd run test:integration
$env:BROWSER_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
npm.cmd run test:browser
```

O teste usa `playwright-core` com Edge/Chrome já instalado, sobe sua própria aplicação em porta efêmera e usa o banco `_test`. Em outros sistemas, ajuste `BROWSER_PATH` para o executável do Chromium/Chrome. Não é necessário baixar um navegador pelo Playwright. O teste cobre cadastro com erro e sucesso, busca, adição, quantidade, remoção, confirmação, histórico, falha e repetição de consulta, cardápio vazio e ausência de rolagem horizontal em 1440, 1024, 768, 390 e 320 px. Ele cria dados de teste sem apagá-los; a integração seguinte os limpa.

## Estrutura e decisões técnicas

```text
public/                 HTML, CSS e JavaScript sem etapa de build
src/app.js              Express, arquivos estáticos e tratamento de erros
src/server.js           Inicialização, migrações e encerramento
src/routes/             Contrato HTTP
src/domain.js           Validação e cálculo puro em centavos
src/services/           Transação de criação de pedido
src/repositories/       Consultas parametrizadas
src/db/                 Pool e executor de migrações
db/                     Esquema SQL e carga fictícia versionada
tests/unit/             Regras e cálculos
tests/integration/      API com PostgreSQL real
tests/browser/          Fluxo na interface com Edge/Chromium
scripts/                Inicialização e validação HTTP/persistência
docs/                   Registro de validação e decisões da interface
```

Produtos têm nome, descrição e `price_cents`. Pedidos têm data com fuso (`TIMESTAMPTZ`) e total; cada item referencia produto e pedido e guarda `product_name`, `unit_price_cents` e quantidade. PKs, FKs, unicidade por produto/pedido e CHECKs asseguram integridade básica. O total e os preços são inteiros; não são usados valores de ponto flutuante no cálculo oficial. O histórico mostra datas no fuso `America/Sao_Paulo`.

A criação de pedido valida a estrutura, abre uma transação, consulta e bloqueia os produtos com `FOR SHARE`, calcula o total a partir dos preços lidos, salva pedido e itens, e confirma com `COMMIT`. Qualquer falha executa `ROLLBACK`. Os bloqueios são obtidos em ordem de ID. Dados enviados como `priceCents`, `unitPriceCents` ou `totalCents` no pedido são ignorados. O preço unitário e o nome salvos mantêm o histórico mesmo se o cadastro do produto for alterado no banco posteriormente.

Limites: nome até 100 caracteres, descrição até 500, preço de 1 a 1.000.000 centavos (R$ 10.000), 1 a 100 produtos distintos por pedido, 1 a 99 unidades por produto e total até 1.000.000.000 centavos. Produto repetido no JSON é rejeitado; no carrinho, a interface agrupa as quantidades.

## API

Valores monetários são inteiros em centavos. Respostas de listas são arrays JSON.

| Método e rota | Operação |
| --- | --- |
| `GET /api/health` | Verifica a conexão com o banco; retorna `{ "status": "ok" }` |
| `GET /api/products` | Lista produtos por ID |
| `POST /api/products` | Cadastra `{ "name": "Suco", "description": "300 ml", "priceCents": 600 }` |
| `POST /api/orders` | Cria `{ "items": [{ "productId": 1, "quantity": 2 }] }` |
| `GET /api/orders?limit=20&offset=0` | Histórico em ordem decrescente; limite máximo 100 |
| `GET /api/orders/:id` | Consulta um pedido com itens |

Cadastros retornam `201`; consultas `200`; validação `400`; produto inexistente em pedido `422`; recurso ausente `404`; corpo acima de 32 KB `413`; falha interna `500`. Erros seguem `{ "error": "mensagem em português" }`. Pedidos retornam `id`, `createdAt`, `totalCents` e `items` com `productId`, `name`, `quantity` e `unitPriceCents`.

Segurança: SQL parametrizado, validação no servidor, limite de JSON, Helmet/CSP, segredos em ambiente, ausência de detalhes SQL nas respostas e uso de `textContent` na interface para conteúdo cadastrado. A aplicação é um sistema demonstrativo para ambiente controlado, sem autenticação/perfis de acesso, pagamento ou gestão de estoque. Antes de disponibilizá-la publicamente, configure autenticação/autorização, HTTPS, limitação de requisições, backups e observabilidade. Se houver perda de conexão durante a confirmação, confira o histórico antes de reenviar: não há chave de idempotência entre tentativas de rede.

## Referência da atividade e validação realizada

Foi consultado o PDF `Atividade Implantação de sistemas.pdf` fornecido no Downloads. Ele solicita Dockerfile/Compose, verificação de estado/portas, auditoria dos logs e testes unitários/de integração. Também menciona RDM em PDF, vídeo de 2 a 5 minutos e publicação no GitHub. Conforme o escopo explícito desta solicitação, esta entrega cobre código, implantação Docker e documentação técnica no repositório; não inclui RDM, gravação de vídeo ou publicação no GitHub.

Veja [docs/validacao.md](docs/validacao.md) para os resultados efetivamente executados e as verificações Docker que precisam ser reproduzidas em um ambiente com Docker Desktop.
