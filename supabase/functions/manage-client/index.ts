import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const safeText = (value: unknown, max = 120) => typeof value === "string" ? value.trim().slice(0, max) : "";
const usernamePattern = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const normalizeUsername = (value: unknown) => typeof value === "string" ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "").trim() : "";
const internalAuthEmail = (username: string) => `${username}@usuarios.filtros.studio`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Configuração protegida do servidor ausente." }, 503);
  const adminApi = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Faça login para continuar." }, 401);
  const { data: authData, error: authError } = await adminApi.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);
  const { data: profile, error: profileError } = await adminApi.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") return json({ error: "Acesso exclusivo do administrador." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const action = safeText(body.action, 32);
  const companyId = safeText(body.company_id, 50);
  const password = typeof body.password === "string" ? body.password : "";
  const name = safeText(body.name, 120);
  const username = normalizeUsername(body.username);

  if (action === "create") {
    if (!name || name.length < 2 || !usernamePattern.test(username) || password.length < 6 || password.length > 128) {
      return json({ error: "Informe empresa, usuário de 3 a 32 caracteres (letras, números, _ ou -) e senha de 6 a 128 caracteres." }, 400);
    }
    const rawFee = body.monthly_fee;
    const monthlyFee = rawFee === "" || rawFee == null ? 0 : Number(rawFee);
    const nextDueDate = typeof body.next_due_date === "string" ? body.next_due_date.trim() : "";
    const rawDueDay = body.due_day;
    const dueDay = monthlyFee === 0 ? 10
      : rawDueDay === "" || rawDueDay == null
        ? (nextDueDate ? Number(nextDueDate.slice(8, 10)) : NaN)
        : Number(rawDueDay);
    if (!Number.isFinite(monthlyFee) || monthlyFee < 0 || monthlyFee > 100000)
      return json({ error: "Mensalidade inválida. Deixe em branco para cadastrar um usuário gratuito." }, 400);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
      return json({ error: "Para um cliente pagante, informe o dia do vencimento ou a data do próximo vencimento." }, 400);
    const { data: createdCompany, error: companyError } = await adminApi.from("companies").insert({
      name, login_username: username, contact_email: null, phone: safeText(body.phone, 50),
      monthly_fee: monthlyFee, due_day: dueDay, next_due_date: monthlyFee > 0 ? nextDueDate || null : null
    }).select("id").single();
    if (companyError?.code === "23505") return json({ error: "Esse nome de usuário já está em uso. Escolha outro." }, 409);
    if (companyError || !createdCompany) return json({ error: companyError?.message || "Não foi possível criar a empresa." }, 400);
    const { data: createdUser, error: userError } = await adminApi.auth.admin.createUser({
      email: internalAuthEmail(username), password, email_confirm: true,
      user_metadata: { display_name: name }
    });
    if (userError || !createdUser.user) {
      await adminApi.from("companies").delete().eq("id", createdCompany.id);
      return json({ error: userError?.message || "Não foi possível criar o login." }, 400);
    }
    const { error: linkError } = await adminApi.from("profiles")
      .update({ role: "client", company_id: createdCompany.id, display_name: name })
      .eq("id", createdUser.user.id);
    if (linkError) {
      await adminApi.auth.admin.deleteUser(createdUser.user.id);
      await adminApi.from("companies").delete().eq("id", createdCompany.id);
      return json({ error: "Erro ao associar login à empresa." }, 500);
    }
    return json({ ok: true, company_id: createdCompany.id, username });
  }

  if (action === "update_username") {
    if (!companyId || !usernamePattern.test(username))
      return json({ error: "Informe uma empresa e um usuário válido de 3 a 32 caracteres." }, 400);
    const { data: company, error: companyError } = await adminApi.from("companies")
      .select("id,login_username").eq("id", companyId).maybeSingle();
    if (companyError || !company) return json({ error: "Empresa não encontrada." }, 404);
    if (company.login_username === username) return json({ ok: true, username });
    const { data: login, error: loginError } = await adminApi.from("profiles")
      .select("id").eq("company_id", companyId).eq("role", "client").maybeSingle();
    if (loginError || !login) return json({ error: "Login do cliente não encontrado." }, 404);
    const { data: exists, error: existsError } = await adminApi.from("companies")
      .select("id").eq("login_username", username).neq("id", companyId).maybeSingle();
    if (existsError) return json({ error: "Não foi possível validar o usuário." }, 500);
    if (exists) return json({ error: "Esse nome de usuário já está em uso." }, 409);
    const { error: updatedLoginError } = await adminApi.auth.admin.updateUserById(login.id, {
      email: internalAuthEmail(username), email_confirm: true
    });
    if (updatedLoginError) return json({ error: "Esse usuário não está disponível ou não foi possível atualizá-lo." }, 409);
    const { error: updatedCompanyError } = await adminApi.from("companies")
      .update({ login_username: username }).eq("id", companyId);
    if (updatedCompanyError) {
      if (company.login_username && usernamePattern.test(company.login_username)) {
        await adminApi.auth.admin.updateUserById(login.id, {
          email: internalAuthEmail(company.login_username), email_confirm: true
        });
      }
      return json({ error: "Não foi possível atualizar o nome de usuário. Tente novamente." }, 409);
    }
    return json({ ok: true, username });
  }

  if (action === "reset_password") {
    if (!companyId || password.length < 6 || password.length > 128)
      return json({ error: "Informe a empresa e uma senha de 6 a 128 caracteres." }, 400);
    const { data: profileRow } = await adminApi.from("profiles").select("id")
      .eq("company_id", companyId).eq("role", "client").maybeSingle();
    if (!profileRow) return json({ error: "Login do cliente não encontrado." }, 404);
    const { error } = await adminApi.auth.admin.updateUserById(profileRow.id, { password });
    if (error) return json({ error: "Não foi possível alterar a senha." }, 400);
    return json({ ok: true });
  }

  if (action === "delete") {
    if (!companyId) return json({ error: "Informe a empresa." }, 400);
    const { data: exists } = await adminApi.from("companies").select("id,logo_path").eq("id", companyId).maybeSingle();
    if (!exists) return json({ error: "Empresa não encontrada." }, 404);
    const { data: filterRows } = await adminApi.from("filters").select("storage_path").eq("company_id", companyId);
    const paths = (filterRows || []).map((row) => row.storage_path).filter(Boolean);
    // O arquivo de identidade visual fica na mesma pasta privada da empresa.
    if (exists.logo_path) paths.push(exists.logo_path);
    if (paths.length) {
      const { error: storageError } = await adminApi.storage.from("company-filters").remove(paths);
      if (storageError) return json({ error: "Erro ao limpar PNGs. A empresa não foi excluída." }, 500);
    }
    const { data: loginRows } = await adminApi.from("profiles").select("id")
      .eq("company_id", companyId).eq("role", "client");
    for (const login of loginRows || []) {
      const { error: deleteAuthError } = await adminApi.auth.admin.deleteUser(login.id);
      if (deleteAuthError) return json({ error: "Falha ao excluir o login. Revise a empresa antes de tentar novamente." }, 500);
    }
    const { error: deleteError } = await adminApi.from("companies").delete().eq("id", companyId);
    if (deleteError) return json({ error: "Falha ao excluir empresa. Verifique o painel." }, 500);
    return json({ ok: true });
  }

  return json({ error: "Ação desconhecida." }, 400);
});