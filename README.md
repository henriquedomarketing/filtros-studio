# Filtros Studio — Versão 2.0

**Marco estável:** 16/11/2026. A versão 2.0 consolida a interface, câmera, editor de texto, filtros e administração existentes. O histórico anterior foi preservado para segurança; o backup de referência está na branch `backup/pre-v2-20261116`.

**Importante:** o código do repositório não contém os registros de usuários, clientes e filtros. Eles permanecem no Supabase atual. Não recrie o projeto Supabase, não execute migrações destrutivas e não altere as credenciais ou a conexão de produção durante uma limpeza de histórico.

Plataforma web independente do projeto antigo `filtros-personalizados`, projetada para até **100 empresas**. Interface brasileira responsiva, pensada para computadores (painel) e iPhone/Android (câmera e filtros).

## Links e recursos

- **Supabase novo**: https://supabase.com/dashboard/project/imfgumnpbxhbrjlkiphf
- **Banco**: PostgreSQL, região São Paulo (`sa-east-1`).
- **Storage privado**: bucket `company-filters`, PNGs com máximo de 12 MB.
- **Servidor para contas**: Supabase Edge Function `manage-client`.
- **Frontend**: `index.html`, `styles.css`, `app.js` (HTML/CSS/JavaScript ES modules).
- **Site de produção**: https://filtros.studio (Vercel conectado à branch `main` do GitHub; deploy `READY` confirmado em 01/11/2026).
- **Migração SQL**: `supabase/migrations/20261101_001_initial_schema.sql` (documentação da estrutura que já foi aplicada ao projeto real).
- **Função do servidor**: `supabase/functions/manage-client/index.ts`.

## Funcionalidades implementadas no código

1. Cadastro e login com **Supabase Auth**.
2. O administrador mantém sua conta de e-mail existente, com liberação de permissões pelo proprietário do projeto; novos cadastros públicos estão desativados no site.
3. Dashboard com indicadores reais, cadastro/edição/exclusão de empresas, mensalidades e vencimentos.
4. Cadastro de categorias e PNGs por empresa (arquivos privados).
5. Câmera do navegador com PNG transparente sobreposto e fotografia 1080×1920. Depois de fotografar, o cliente vê **uma tela de resultado com prévia** em vez de baixar automaticamente: Compartilhar, Instagram Stories, WhatsApp, Salvar no celular, Nova foto e Trocar filtro. A foto permanece **temporariamente no navegador**, sem envio automático ao banco.

**Compartilhamento mobile:** o aplicativo usa a Web Share API quando o navegador aceita compartilhar arquivos. Os botões Instagram Stories e WhatsApp abrem a seleção nativa do sistema; não publicam automaticamente nem conseguem forçar qual aplicativo ou recurso será aberto. Em iPhone, "Salvar no celular" usa o menu nativo para escolher "Salvar Imagem" ou "Salvar em Arquivos", quando disponível. Em outros casos, oferece download PNG.
6. Alteração da senha dos clientes via Edge Function autenticada.
7. Controle manual de cobranças. **Não** emite boletos nem consulta bancos.
8. Configuração do nome da plataforma e WhatsApp de suporte.

## Ordem das categorias por arrastar e soltar

Em **Filtros PNG → Categorias**, o administrador escolhe a **empresa** e pode **segurar o ícone ⠿ de uma categoria e arrastá-la para cima ou para baixo**. A funcionalidade aceita mouse em computadores e toque em celulares; como alternativa acessível, cada categoria tem os botões **↑ Subir** e **↓ Descer**.

A nova sequência é salva automaticamente no Supabase pela função `public.reorder_company_categories`, em **uma operação atômica** que exige administrador, valida a lista completa e proíbe misturar categorias de empresas diferentes. O aplicativo carrega as categorias com `order('sort_order').order('created_at')`: assim a ordenação é refletida na **tela inicial do cliente**, no **menu lateral da câmera** e em **Testar filtros**. Alterações aparecem nas sessões dos clientes ao atualizar/abrir novamente o app.

A migração `supabase/migrations/20261103_008_category_drag_order.sql` inicializa a ordem de categorias existentes usando o cadastro original e faz **novas categorias entrarem ao fim** da lista. A reordenação não altera PNGs, nomes ou outros dados dos clientes.

## Administração de filtros e categorias

No painel do administrador, a navegação possui **uma única área "Filtros PNG"** para:
- consultar, criar, renomear ou excluir categorias de cada empresa;
- cadastrar filtros novos escolhendo **uma categoria já existente** ou **"＋ Criar nova categoria…"** no mesmo formulário;
- preencher o nome da nova categoria apenas quando essa opção é selecionada;
- validar o PNG e registrar a nova categoria vinculada à empresa selecionada, seguida do envio do filtro.

Se ocorrer erro no envio após criar uma categoria, o aplicativo tenta desfazer a categoria nova quando ainda estiver vazia. Os dados de categorias e filtros antigos continuam nas mesmas tabelas protegidas por RLS.

## Testar filtros sem sair do painel (administrador)

A aba **Testar filtros** aparece no menu administrativo, ao lado de **Filtros PNG**. O administrador escolhe a empresa e a categoria para visualizar as miniaturas dos PNGs **somente daquele cliente**. Em seguida, toca em **Abrir câmera para testar**.

- O teste usa **a mesma prévia de câmera, filtros, importação da galeria, recorte 1080 × 1920 e tela de compartilhamento dos funcionários**, mas conserva a sessão de administrador; não é necessário login do cliente.
- O menu lateral da câmera mostra apenas as categorias da empresa selecionada e substitui **Sair da conta** por **Encerrar teste e voltar ao painel**. Na tela final, **Voltar** reinicia a câmera normalmente.
- A seleção é limitada a uma empresa e categoria válidas; navegar ou fotografar não modifica empresas, categorias nem filtros salvos no banco.

## Clientes gratuitos e campos opcionais

No cadastro e na edição de **Clientes**, os campos **Telefone/WhatsApp**, **Mensalidade em reais**, **Dia do vencimento** e **Próximo vencimento** são opcionais. Se a mensalidade não for informada ou for **R$ 0,00**, a conta é tratada como **gratuita/isenta**, independentemente de dados de contato e datas. A listagem apresenta **Gratuito / isento** e **—** como vencimento; o banco mantém `monthly_fee=0` e `next_due_date=null`.

**Não se cria cobrança mensal automática** para contas gratuitas; ao transformar uma conta pagante em gratuita, a sincronização financeira cancela cobranças automáticas ainda pendentes e preserva o histórico de cobranças já pagas. Cobranças manuais eventualmente lançadas pelo administrador permanecem independentes.

Para clientes pagantes, basta informar **mensalidade maior que zero** e **dia do vencimento ou próximo vencimento**. Quando houver somente o dia, a próxima data é calculada pelo banco. Telefone/WhatsApp nunca é obrigatório.

## Mensalidades e Financeiro sincronizados

Uma nova migração (`20261102_004_auto_monthly_finance.sql`) sincroniza **mensalidade, ativação e próximo vencimento** com o Financeiro. Empresa ativa com mensalidade acima de zero recebe uma cobrança automática pendente, sem duplicar o lançamento do mesmo ciclo. Alterações de valor ou vencimento atualizam a mensalidade pendente. A inativação cancela as mensalidades automáticas pendentes; os pagamentos já feitos são preservados. Ao marcar uma mensalidade automática como paga, o próximo vencimento é calculado para o mês seguinte. **Cobranças manuais** permanecem independentes.

No painel, a **Visão geral** informa o valor a receber; em **Financeiro**, o tipo *Mensalidade* ou *Manual* fica identificado e o botão **Editar mensalidade** leva ao cadastro da empresa. Não há geração ou envio automático de boletos bancários, apenas controle financeiro dos lançamentos.

## Login com atendimento SUPORT

A tela de login é exclusiva para contas já criadas e apresenta **nome de usuário, senha, Entrar** e o link **SUPORT** (https://wa.me/5544997497915). **Clientes não cadastram nem digitam e-mail:** o administrador escolhe um nome de usuário exclusivo (por exemplo, `p4veiculos`) e uma senha ao adicionar a empresa em **Clientes**. O administrador continua entrando com **seu mesmo e-mail e senha**, no campo de nome de usuário. As opções de **Primeiro acesso** e **Criar conta** foram removidas, sem inscrição pública no aplicativo.

O Supabase Auth exige um endereço de autenticação nos bastidores; por isso o sistema cria automaticamente um identificador técnico `usuario@usuarios.filtros.studio`, que **não é um e-mail que o cliente precisa criar ou possuir**. A Edge Function é a única responsável por criar e modificar esses logins, sempre verificando a sessão administrativa. Alterar o nome de usuário de uma empresa também atualiza seu identificador interno. Não há recuperação de senha por e-mail para clientes; o administrador pode redefinir as senhas no painel.

## Biblioteca de filtros PNG: visualizar e gerenciar

Em **Painel administrativo → Filtros PNG → Filtros cadastrados**, clique na miniatura ou em **Visualizar e editar** para abrir a imagem PNG inteira, em uma prévia grande. É possível alternar entre fundo quadriculado e fundo escuro para conferir detalhes transparentes ou brancos.

Na mesma janela, o administrador pode **renomear**, **mover o filtro para outra categoria da mesma empresa**, **substituir o arquivo PNG** (com prévia antes de salvar) ou **excluir** mediante confirmação. Para encontrar os arquivos mais rápido, a biblioteca permite filtrar por **empresa** e **categoria**.

Substituir o PNG mantém o ID do filtro e o vínculo com a empresa, cria o novo arquivo em caminho exclusivo e só elimina o antigo **depois** de atualizar o banco com sucesso; em falha na atualização, o novo upload é removido e o cadastro anterior continua válido. A biblioteca mantém a exigência de PNG transparente com até 12 MB.

## Pausar e reativar o acesso dos clientes

Em **Painel administrativo → Clientes**, cada empresa dispõe de **Pausar acesso** e, quando pausada, **Reativar acesso**. Essa função usa `companies.access_paused`, separada do cadastro financeiro: **não cancela mensalidades, não apaga pagamentos, não exclui logins e não altera os filtros cadastrados**.

- Quando uma empresa está pausada, o cliente consegue autenticar sua conta, mas **não pode utilizar categorias, câmera ou PNGs**. O aplicativo exibe a tela **“Acesso temporariamente pausado”**, orienta a entrar em contato com o suporte e oferece **Verificar novamente** e **Sair da conta**.
- O telefone e o link do WhatsApp são carregados de **Configurações → WhatsApp de suporte** (registro `app_settings.branding.supportWhatsapp`). Basta configurar uma vez para que ele seja exibido aos clientes pausados e às contas aguardando ativação, sem cadastrar o mesmo número por empresa. Ao alterar o contato, o novo número aparece quando o cliente entrar ou atualizar a situação.
- Se o telefone ainda não foi cadastrado, aparece um aviso neutro, **sem inventar número ou link**. Formatos brasileiros com DDD são aceitos, com ou sem `+55`.
- O banco usa **RLS** para impedir que empresas pausadas leiam categorias, filtros e imagens privadas, mesmo mantendo uma sessão autenticada; administradores continuam com acesso para suporte e testes.
- Para um cliente já conectado, as restrições do banco se aplicam a novas consultas imediatamente. Arquivos que já tenham sido carregados no navegador não podem ser retirados retroativamente; a tela de bloqueio aparece na próxima verificação de sessão/atualização.

## Créditos no rodapé

O sistema apresenta, com visual discreto e responsivo, os créditos **“Desenvolvido por @henriquedomarketing”** e **“Desde 2025 · Todos os direitos reservados.”** na página de login, no painel administrativo, na página inicial das empresas e na tela de resultado da foto. A tela da câmera não exibe esse rodapé para manter o enquadramento e os controles desobstruídos.

## Aparência e fluxo mobile (novembro de 2026)

- **A tela inicial do cliente** usa a identidade única Filtros Studio e destaca a logo PNG original da empresa numa moldura compacta, sem sobrepor títulos; a imagem não é alterada. PNG com fundo branco não é necessariamente transparente, portanto prefira a logo com canal alfa.
- Ao entrar numa categoria, **a câmera tem fundo branco e a identidade padrão do Filtros Studio** (azul anil oficial `#001893`), sem reproduzir as cores da loja.
- **Câmera ampla, com filtros no topo**: ao entrar na categoria, o menu ☰ permanece à esquerda e os filtros aparecem em **cards quadrados de 58 × 58 px (20% menores que os anteriores), do mesmo tamanho do botão do menu**, alinhados horizontalmente e com rolagem lateral. A prévia 9:16 ocupa a largura do celular (até 420px), seguida pelos controles de fotografar e Galeria. O painel duplicado de filtros que ficava embaixo foi removido.
- **Menu ☰ no topo, onde ficava a logo**: a faixa branca superior reúne o botão ☰ e os filtros em cards quadrados alinhados, sem cobrir a prévia. A gaveta lateral tem fundo **azul #001893**, com **Página inicial em primeiro lugar**, categorias em seguida e **Sair da conta** no rodapé.
- Ordem na câmera: **menu ☰ + filtros quadrados horizontais → prévia grande da câmera → controles (Alternar / botão vermelho / Galeria) → Salvar ou compartilhar (somente após importar da galeria)**.
- **Importar da galeria**: ao tocar em **Galeria**, o funcionário escolhe uma foto do próprio aparelho (até 25 MB; formatos de imagem que o navegador consiga abrir). Ela aparece dentro do enquadramento 9:16 com o **filtro selecionado**; basta tocar em outro filtro para trocá-lo sem importar a imagem outra vez. No modo galeria, **← Voltar à câmera** fica visível sobre a foto e o botão inferior esquerdo também diz **Voltar**; ambos descartam a imagem importada e reiniciam a câmera sem sair da conta. Para finalizar, toca no botão vermelho ou em **Salvar ou compartilhar** para abrir a tela de resultado.
- **Sem esticar**: foto horizontal, quadrada ou vertical usa recorte central proporcional (`object-fit: cover`), com resultado fixo em **1080 × 1920 px**. Foto horizontal perde as laterais. Algumas fotos HEIC podem depender do suporte do navegador; para incompatíveis, tente JPEG ou PNG.
- **Privacidade da galeria e reinício limpo**: a foto escolhida é tratada temporariamente no navegador do aparelho e não é enviada ao Supabase. Na tela de resultado, **Voltar**, **Nova foto** e **Trocar filtro** sempre descartam a imagem importada e a foto final anterior, encerram a câmera anterior e reabrem uma câmera limpa (traseira), com o primeiro filtro da categoria selecionado. Isso vale tanto para fotos tiradas no aplicativo quanto para fotos importadas, mesmo depois de salvar ou compartilhar. O usuário pode importar outra imagem ou tirar uma nova foto.
- A tela de resultado também usa a identidade neutra da plataforma, com prévia final e ações de compartilhamento.
- O painel administrativo usa azul-marinho escuro; o menu mobile abre por botão ☰, enquanto o desktop mantém a lateral fixa.

## Design system oficial do Filtros Studio (novembro de 2026)

A interface inteira usa **identidade única do Filtros Studio**, inspirada em padrões visuais leves do iOS e Meta: azul-anil `#001893`, azul de ação `#244CFF`, superfícies brancas, fundo `#F5F7FC`, contraste acessível, cards arredondados e sombras discretas.

- **Login**: cartão central claro, campos de usuário e senha e link SUPORT; administrador conserva login por e-mail.
- **Painel administrativo**: navegação azul, cards claros, tabelas e modais com espaçamentos consistentes.
- **Área do cliente**: **todas as empresas recebem a mesma interface branca/azul**. As categorias e o menu da câmera não assumem a cor do cliente.
- **Personalização por empresa**: **somente a logo original em PNG**, exibida em destaque na tela inicial após login, sem mudar proporção nem cores do arquivo. Nenhuma logo ou arte será recriada.
- **Câmera**: permanece com preview grande 9:16, filtros e menu no topo, foto/galeria e exportação em 1080×1920.
- **Código seguro para manter**: as alterações visuais estão separadas em `studio-redesign.css`, carregado **depois** dos CSS antigos; a regra de cor fixa fica em `brandStyle()`. Assim, o estilo pode ser refinado ou revertido sem reescrever lógica da aplicação.

O administrador cadastra a logo original em **Clientes → Novo cliente**, em PNG de qualquer dimensão ou proporção (quadrada, horizontal ou vertical) com até **2 MB**. O arquivo é armazenado no bucket privado `company-filters`, no caminho `{company_id}/branding/{uuid}.png`; `companies.logo_path` aponta para o arquivo. As permissões RLS permitem que cada empresa autenticada leia somente sua própria logo e filtros. Para trocar a logo, use **Clientes → Editar**.

As colunas antigas de cores da empresa permanecem no banco por compatibilidade, mas **não interferem mais na aparência do aplicativo**. Os antigos seletores de cores foram retirados do formulário. Se o upload da logo falhar, o cliente pode existir com personalização pendente; basta reenviar o PNG na edição, sem duplicar a conta.

## Configuração e primeiro administrador (sem publicar segredos)

A instalação já tem banco/schema criados e uma Edge Function ativa, mas **não existe conta administrativa criada automaticamente**.

1. No [Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/imfgumnpbxhbrjlkiphf/auth/url-configuration), defina **Site URL** como `https://filtros.studio` e salve. Isso evita redirecionar a confirmação de e-mail para `localhost`.
2. Abra https://filtros.studio, clique em **Criar conta inicial** e registre seu e-mail com senha forte.
3. Confirme o e-mail enviado pelo Supabase (conforme configuração de autenticação).
4. O dono do projeto, com acesso ao Supabase, deve promover **somente aquela conta verificada**. Esse passo pode ser executado no SQL Editor:

```sql
update public.profiles
set role = 'admin', company_id = null
where id = (select id from auth.users where email = 'EMAIL_CONFIRMADO_DO_ADMINISTRADOR');
```

5. Faça logout/login novamente. O dashboard administrativo aparecerá.
6. No painel, crie empresas com nome de usuário e senha individual, sem precisar cadastrar e-mail dos clientes. Empresas inativas não poderão carregar os filtros.

**Não compartilhe senhas, tokens ou chaves `service_role` por chat ou em repositórios.** O projeto contém apenas uma chave *publicável* de frontend, que pode ser vista em navegadores e depende de políticas RLS para a segurança real. Qualquer configuração `SUPABASE_SERVICE_ROLE_KEY` deve permanecer apenas nas variáveis protegidas do Supabase Edge Function.

## Executar localmente

Não precisa compilar. Em um computador com Python:

```bash
python3 -m http.server 5173
```

Abra http://localhost:5173. Para câmera em celulares, publique em um host HTTPS (GitHub Pages, Vercel etc.). Abrir via IP na rede local sem HTTPS pode bloquear a câmera.

## Publicar na Vercel

Crie um projeto apontando para a raiz do repositório; **Framework: Other**, sem comando de build, usando os arquivos estáticos. O arquivo `vercel.json` já inclui cabeçalhos básicos. Após conectar GitHub, cada commit poderá produzir uma nova versão publicada.

## Segurança

- Tabelas com **Row Level Security** e leitura isolada por empresa.
- `profiles.role='admin'` não pode ser alterado pelo navegador de clientes.
- Criação/remoção de logins feita pela Edge Function que valida JWT e cargo administrativo.
- PNGs ficam em bucket privado; são obtidos pela sessão autenticada, não por link público permanente.
- Senhas gerenciadas por Supabase Auth, nunca salvas em planilhas ou no PostgreSQL da aplicação.
- Registros de clientes e cobranças no banco novo, separados do aplicativo antigo.
- A plataforma limita a 100 empresas através de gatilho no banco.

## Pendências para produção

- **GitHub vinculado:** https://github.com/henriquedomarketing/filtros-studio.
- **Site HTTPS publicado:** https://filtros.studio.
- Configurar **Site URL** de autenticação no Supabase e cadastrar/autorizar a primeira conta administrativa.
- Validar a experiência no Safari iPhone e Chrome Android.
- Testar o cadastro/exclusão de uma empresa e o envio/download/captura de um PNG real, com as regras RLS habilitadas.
- Validar backup, políticas de privacidade, alertas de cobrança, recuperação de senhas e rotinas de limpeza de PNGs órfãos.
- Monitorar os limites do plano Supabase/Vercel, que podem mudar.

## Estrutura

```text
filtros-studio/
├── index.html
├── styles.css
├── app.js
├── vercel.json
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── docs/
│   └── ARCHITECTURE.md
└── supabase/
    ├── migrations/20261101_001_initial_schema.sql
    └── functions/manage-client/index.ts
```

## Notas para futuras IAs e desenvolvedores

Comece por **README.md** e **docs/ARCHITECTURE.md**, examine a migração SQL e revise as políticas RLS antes de qualquer mudança no banco. Nunca usar chaves secretas no navegador. Não misturar este projeto com o antigo repositório de filtros Flutter/Firebase. Qualquer alteração de schema deve virar uma nova migração; não editar retrospectivamente a migração inicial. Antes de aplicar uma mudança, testar num ambiente separado.


## Domínio e identidade da marca

**Marca oficial:** Filtros Studio. **Domínio principal:** https://filtros.studio. O DNS precisa apontar o registro A do domínio para a Vercel; `www.filtros.studio` redireciona ao domínio principal. Para o login por e-mail, adicionar o domínio às URLs autorizadas no Supabase Auth. **GitHub:** https://github.com/henriquedomarketing/filtros-studio (repositório já renomeado). **Vercel:** projeto `filtros-studio`, com domínio principal `filtros.studio`. **Supabase:** projeto renomeado `filtros-studio`, preservando o Project ID e a região. Em Auth → URL Configuration, configurar `https://filtros.studio` como Site URL e adicionar nas Redirect URLs.
