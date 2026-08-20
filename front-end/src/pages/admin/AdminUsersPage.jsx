import { Fragment, useEffect, useState } from "react";
import { api } from "../../api/client";
import PasswordInput from "../../components/PasswordInput";
import "../../styles/admin.css";

const EMPTY_FORM = { name: "", username: "", email: "", password: "", role: "client" };

function UserForm({ initial, onSubmit, onCancel, submitLabel, isEdit }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (isEdit && !payload.password) {
        delete payload.password;
      }
      await onSubmit(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="vehicle-form" onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <label>
        Name
        <input value={form.name} onChange={(e) => update("name", e.target.value)} required />
      </label>
      <label>
        Username
        <input
          value={form.username}
          onChange={(e) => update("username", e.target.value)}
          minLength={3}
          required
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          required
        />
      </label>
      <label>
        {isEdit ? "New password (leave blank to keep current)" : "Password"}
        <PasswordInput
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          minLength={6}
          required={!isEdit}
        />
      </label>
      <label>
        Role
        <select value={form.role} onChange={(e) => update("role", e.target.value)}>
          <option value="client">Client</option>
          <option value="company">Company</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  function load() {
    setLoading(true);
    api
      .get("/api/users")
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(data) {
    await api.post("/api/users", data);
    setShowAddForm(false);
    load();
  }

  async function handleUpdate(id, data) {
    await api.patch(`/api/users/${id}`, data);
    setEditingId(null);
    load();
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Manage Users</h1>
        <button onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Close" : "Add User"}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {showAddForm && (
        <UserForm
          initial={EMPTY_FORM}
          submitLabel="Create User"
          onSubmit={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading && <p className="page-loading">Loading users...</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <Fragment key={u.id}>
              <tr>
                <td>{u.name}</td>
                <td>{u.username || <em>none</em>}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td className="admin-row-actions">
                  <button onClick={() => setEditingId(editingId === u.id ? null : u.id)}>
                    {editingId === u.id ? "Close" : "Edit"}
                  </button>
                </td>
              </tr>
              {editingId === u.id && (
                <tr>
                  <td colSpan={5}>
                    <UserForm
                      initial={{ ...u, username: u.username || "", password: "" }}
                      submitLabel="Save Changes"
                      isEdit
                      onSubmit={(data) => handleUpdate(u.id, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
