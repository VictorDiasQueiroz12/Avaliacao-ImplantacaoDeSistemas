const $ = selector => document.querySelector(selector);
const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = value => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const state = { products: [], cart: new Map(), orders: [], offset: 0, loadingProducts: false, productsReady: false, loadingOrders: false, submitting: false };
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
async function api(path, options = {}) {
  let response;
  try { response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) }); }
  catch { throw new Error('Não foi possível conectar à cantina. Verifique sua conexão e tente novamente.'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('O servidor retornou uma resposta inesperada. Tente novamente.'); }
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}
function notify(message, error = false) {
  const notice = $('#notice'); notice.textContent = message; notice.className = error ? 'notice error' : 'notice'; notice.hidden = false;
}
function showState(selector, message, retry) {
  const element = $(selector); element.replaceChildren(); element.hidden = !message;
  if (!message) return;
  element.append(node('span', '', message));
  if (retry) { const button = node('button', 'secondary', 'Tentar novamente'); button.onclick = retry; element.append(button); }
}
function addProduct(id) {
  const quantity = state.cart.get(id) || 0;
  if (quantity >= 99) return notify('O limite é de 99 unidades por produto.', true);
  state.cart.set(id, quantity + 1); renderCart();
  notify('Produto adicionado. Você pode conferir os itens em Novo pedido.');
}
function addButton(product) {
  const button = node('button', 'add-button', '＋ Adicionar');
  button.setAttribute('aria-label', `Adicionar ${product.name}`);
  button.disabled = state.submitting;
  button.onclick = () => addProduct(product.id);
  return button;
}
function renderProducts() {
  const term = $('#search').value.toLocaleLowerCase('pt-BR').trim();
  $('#products').replaceChildren(); $('#order-products').replaceChildren();
  $('#product-count').textContent = state.products.length;
  const filtered = state.products.filter(p => `${p.name} ${p.description}`.toLocaleLowerCase('pt-BR').includes(term));
  for (const product of filtered) {
    const card = node('article', 'product-card');
    const symbol = node('span', 'product-symbol', product.name.substring(0, 1).toLocaleUpperCase('pt-BR')); symbol.setAttribute('aria-hidden', 'true');
    card.append(symbol, node('h3', '', product.name), node('p', '', product.description || 'Produto da cantina.'));
    const bottom = node('div', 'product-bottom'); bottom.append(node('span', 'price', money(product.priceCents)), addButton(product)); card.append(bottom); $('#products').append(card);
  }
  for (const product of state.products) {
    const row = node('article', 'order-product'); const details = node('div');
    details.append(node('h3', '', product.name), node('p', '', product.description), node('span', 'price', money(product.priceCents)));
    row.append(details, addButton(product)); $('#order-products').append(row);
  }
  showState('#products-state', !state.products.length ? 'O cardápio está vazio. Cadastre o primeiro produto.' : !filtered.length ? 'Nenhum produto encontrado para esta busca.' : '');
  showState('#order-products-state', !state.products.length ? 'Ainda não há produtos. Cadastre um produto no cardápio.' : '');
}
async function loadProducts() {
  if (state.loadingProducts || state.submitting) return;
  state.loadingProducts = true; $('#reload-products').disabled = true;
  showState('#products-state', 'Carregando cardápio…'); showState('#order-products-state', 'Carregando produtos…');
  try {
    state.products = await api('/products'); state.productsReady = true;
    renderProducts(); renderCart();
  } catch (error) {
    state.productsReady = false; $('#products').replaceChildren(); $('#order-products').replaceChildren();
    showState('#products-state', error.message, loadProducts); showState('#order-products-state', error.message, loadProducts); renderCart();
  } finally { state.loadingProducts = false; $('#reload-products').disabled = false; }
}
function updateQuantity(id, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) { notify('Informe uma quantidade inteira de 1 a 99.', true); renderCart(); return; }
  state.cart.set(id, quantity); renderCart();
}
function renderCart() {
  const container = $('#cart-items'); container.replaceChildren(); let total = 0; let count = 0;
  for (const [id, quantity] of state.cart) {
    const product = state.products.find(p => p.id === id);
    if (!product) continue;
    total += product.priceCents * quantity; count += quantity;
    const item = node('div', 'cart-item'), head = node('div', 'cart-item-head'), details = node('div');
    details.append(node('h3', '', product.name), node('p', '', `${money(product.priceCents)} por unidade`));
    const remove = node('button', 'icon-button', '×'); remove.setAttribute('aria-label', `Remover ${product.name}`); remove.disabled = state.submitting;
    remove.onclick = () => { state.cart.delete(id); renderCart(); }; head.append(details, remove);
    const row = node('div', 'quantity-row'), controls = node('div', 'quantity');
    const minus = node('button', '', '−'), plus = node('button', '', '+'), input = node('input');
    minus.setAttribute('aria-label', `Diminuir quantidade de ${product.name}`); plus.setAttribute('aria-label', `Aumentar quantidade de ${product.name}`);
    input.type = 'number'; input.min = '1'; input.max = '99'; input.step = '1'; input.value = quantity; input.setAttribute('aria-label', `Quantidade de ${product.name}`);
    minus.disabled = quantity <= 1 || state.submitting; plus.disabled = quantity >= 99 || state.submitting; input.disabled = state.submitting;
    minus.onclick = () => updateQuantity(id, quantity - 1); plus.onclick = () => updateQuantity(id, quantity + 1);
    input.onchange = () => updateQuantity(id, Number(input.value));
    controls.append(minus, input, plus); row.append(controls, node('span', 'line-total', money(product.priceCents * quantity)));
    item.append(head, row); container.append(item);
  }
  if (!count) container.append(node('p', 'cart-empty', 'Seu pedido começa com um lanche. Adicione produtos ao lado.'));
  $('#cart-total').textContent = money(total); $('#cart-count').textContent = count; $('#cart-count').hidden = !count;
  $('#confirm-order').disabled = !count || state.submitting || !state.productsReady;
}
$('#confirm-order').onclick = async () => {
  if (state.submitting || !state.cart.size) return;
  state.submitting = true; $('#order-feedback').textContent = ''; renderCart(); renderProducts();
  $('#confirm-order').textContent = 'Registrando pedido…';
  try {
    const order = await api('/orders', { method: 'POST', body: JSON.stringify({ items: [...state.cart].map(([productId, quantity]) => ({ productId, quantity })) }) });
    state.cart.clear(); notify(`Pedido #${String(order.id).padStart(4, '0')} registrado com sucesso. Total: ${money(order.totalCents)}.`);
    location.hash = '#historico';
  } catch (error) {
    $('#order-feedback').textContent = `${error.message} Se a conexão caiu durante o envio, confira o histórico antes de reenviar.`;
  } finally { state.submitting = false; $('#confirm-order').textContent = 'Confirmar pedido →'; renderCart(); renderProducts(); }
};
function renderOrders() {
  $('#orders').replaceChildren();
  for (const order of state.orders) {
    const card = node('article', 'order-record'), header = node('div', 'order-record-header'), details = node('div');
    const time = node('time', '', date(order.createdAt)); time.dateTime = order.createdAt;
    details.append(node('h3', '', `Pedido #${String(order.id).padStart(4, '0')}`), time); header.append(details, node('strong', 'price', money(order.totalCents)));
    const list = node('ul');
    for (const item of order.items) {
      const li = node('li'), description = node('span', '', `${item.quantity} × ${item.name}`);
      description.append(node('small', '', `${money(item.unitPriceCents)} por unidade`));
      li.append(description, node('span', '', money(item.unitPriceCents * item.quantity))); list.append(li);
    }
    card.append(header, list); $('#orders').append(card);
  }
}
async function loadOrders(append = false) {
  if (state.loadingOrders) return;
  state.loadingOrders = true; $('#reload-orders').disabled = true; $('#load-more').disabled = true;
  if (!append) { state.offset = 0; state.orders = []; $('#orders').replaceChildren(); $('#load-more').hidden = true; }
  showState('#orders-state', 'Carregando pedidos…');
  try {
    const orders = await api(`/orders?limit=20&offset=${state.offset}`);
    state.orders.push(...orders); state.offset += orders.length; renderOrders();
    showState('#orders-state', !state.orders.length ? 'Nenhum pedido registrado. Crie o primeiro em Novo pedido.' : '');
    $('#load-more').hidden = orders.length < 20;
  } catch (error) { showState('#orders-state', error.message, () => loadOrders(append)); }
  finally { state.loadingOrders = false; $('#reload-orders').disabled = false; $('#load-more').disabled = false; }
}
function route() {
  const page = ['cardapio', 'pedido', 'historico'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'cardapio';
  const titles = { cardapio: 'Cardápio', pedido: 'Novo pedido', historico: 'Histórico' };
  for (const section of document.querySelectorAll('main>section')) section.hidden = section.id !== page;
  for (const link of document.querySelectorAll('[data-page]')) {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
  $('#breadcrumb').textContent = titles[page]; document.title = `${titles[page]} · EstuLanches`;
  if (page === 'historico') loadOrders();
  if (page === 'pedido') renderCart();
}
const dialog = $('#product-dialog');
$('#open-product').onclick = () => { $('#product-error').textContent = ''; dialog.showModal(); };
$('#close-product').onclick = $('#cancel-product').onclick = () => dialog.close();
$('#product-form').onsubmit = async event => {
  event.preventDefault(); if ($('#save-product').disabled) return;
  const name = $('#product-name').value.trim(), price = $('#product-price').value.trim();
  const validName = name.length > 0 && name.length <= 100;
  const match = /^(\d{1,5})(?:[,.](\d{1,2}))?$/.exec(price);
  const priceCents = match ? Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0')) : 0;
  const validPrice = priceCents >= 1 && priceCents <= 1000000;
  $('#name-error').textContent = validName ? '' : 'Informe o nome do produto.';
  $('#price-error').textContent = validPrice ? '' : 'Informe um preço de R$ 0,01 a R$ 10.000,00, sem separador de milhar.';
  $('#product-name').setAttribute('aria-invalid', !validName); $('#product-price').setAttribute('aria-invalid', !validPrice);
  if (!validName || !validPrice) { $(validName ? '#product-price' : '#product-name').focus(); return; }
  $('#save-product').disabled = true; $('#save-product').textContent = 'Cadastrando…'; $('#product-error').textContent = '';
  try {
    const product = await api('/products', { method: 'POST', body: JSON.stringify({ name, description: $('#product-description').value.trim(), priceCents }) });
    dialog.close(); $('#product-form').reset(); $('#search').value = ''; notify(`${product.name} cadastrado com sucesso.`); await loadProducts();
  } catch (error) { $('#product-error').textContent = error.message; }
  finally { $('#save-product').disabled = false; $('#save-product').textContent = 'Cadastrar produto'; }
};
$('#search').oninput = () => { if (state.productsReady) renderProducts(); };
$('#reload-products').onclick = loadProducts;
$('#reload-orders').onclick = () => loadOrders();
$('#load-more').onclick = () => loadOrders(true);
window.addEventListener('hashchange', route);
renderCart(); route(); loadProducts();
