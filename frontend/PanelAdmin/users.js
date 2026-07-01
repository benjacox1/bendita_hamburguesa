(function(){
  const tableBody = document.querySelector('#tabla-usuarios tbody');
  if (!tableBody) return;

  async function loadUsers(){
    const headers = window.getAdminAuthHeaders?.() || {};
    const response = await fetch(`${window.APP_CONFIG?.API_BASE || 'http://localhost:4000/api'}/auth/users`, {
      headers: { ...headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      tableBody.innerHTML = `<tr><td colspan="5">${data.error || 'No se pudieron cargar usuarios'}</td></tr>`;
      return;
    }

    const rows = (data.users || []).map(user => `
      <tr>
        <td>${user.username}</td>
        <td>${user.isApproved ? 'Aprobado' : 'Pendiente'}</td>
        <td>${user.isAdmin ? 'Admin' : 'Usuario'}</td>
        <td>${user.createdAt || '-'}</td>
        <td>
          ${!user.isApproved ? `<button class="small primary" data-action="approve" data-id="${user.id}">Aprobar</button>` : ''}
          <button class="small danger" data-action="reject" data-id="${user.id}">Rechazar</button>
        </td>
      </tr>
    `).join('');

    tableBody.innerHTML = rows || '<tr><td colspan="5">No hay usuarios registrados.</td></tr>';
  }

  tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.action;
    const headers = window.getAdminAuthHeaders?.() || {};
    const response = await fetch(`${window.APP_CONFIG?.API_BASE || 'http://localhost:4000/api'}/auth/users/${id}/${action}`, {
      method: 'PATCH',
      headers: { ...headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(data.error || 'No se pudo actualizar el usuario');
      return;
    }
    await loadUsers();
  });

  loadUsers();
})();
