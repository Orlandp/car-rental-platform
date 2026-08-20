import { Fragment, useEffect, useState } from "react";
import { Plus, UserRound, X } from "lucide-react";
import { api } from "../../api/client";
import PasswordInput from "../../components/PasswordInput";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field, { Input, Select } from "../../components/ui/Field";
import Alert from "../../components/ui/Alert";
import PageLoader from "../../components/ui/PageLoader";

const EMPTY_FORM = { name: "", username: "", email: "", password: "", role: "client" };

const ROLE_TONES = { admin: "brand", company: "info", client: "neutral" };

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
    <Card className="mb-4 p-5">
      <form onSubmit={handleSubmit}>
        <Alert variant="error">{error}</Alert>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </Field>
          <Field label="Username" required>
            <Input
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              minLength={3}
              required
            />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
          </Field>
          <Field label={isEdit ? "New password (leave blank to keep current)" : "Password"} required={!isEdit}>
            <PasswordInput
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              minLength={6}
              required={!isEdit}
            />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => update("role", e.target.value)}>
              <option value="client">Client</option>
              <option value="company">Company</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
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
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Manage Users</h1>
        <Button icon={showAddForm ? X : Plus} onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Close" : "Add User"}
        </Button>
      </div>

      <Alert variant="error">{error}</Alert>

      {showAddForm && (
        <UserForm
          initial={EMPTY_FORM}
          submitLabel="Create User"
          onSubmit={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading ? (
        <PageLoader />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-hover text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <Fragment key={u.id}>
                    <tr className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3 font-medium text-text">
                        <span className="flex items-center gap-2">
                          <UserRound className="size-4 text-muted" /> {u.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{u.username || <em>none</em>}</td>
                      <td className="px-4 py-3 text-muted">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge tone={ROLE_TONES[u.role]}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                        >
                          {editingId === u.id ? "Close" : "Edit"}
                        </Button>
                      </td>
                    </tr>
                    {editingId === u.id && (
                      <tr>
                        <td colSpan={5} className="bg-surface-hover px-4 py-4">
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
        </Card>
      )}
    </div>
  );
}
