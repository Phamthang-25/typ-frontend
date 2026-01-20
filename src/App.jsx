import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "./api";

const emptyForm = {
  id: null,
  student_code: "",
  full_name: "",
  email: "",
  dob: "",
  class_name: "",
};

export default function App() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const isEdit = useMemo(() => form?.id != null, [form]);

  async function load(q) {
    setLoading(true);
    setError("");
    try {
      const qs = (q || "").trim();
      const url = qs ? `/api/students?q=${encodeURIComponent(qs)}` : "/api/students";
      const data = await apiGet(url);
      setStudents(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function pickStudent(s) {
    setError("");
    setForm({
      id: s.id,
      student_code: s.student_code || "",
      full_name: s.full_name || "",
      email: s.email || "",
      dob: s.dob ? String(s.dob).slice(0, 10) : "",
      class_name: s.class_name || "",
    });
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (!form.student_code || !form.full_name) {
        setError("student_code và full_name là bắt buộc");
        return;
      }
      if (isEdit) {
        await apiSend(`/api/students/${form.id}`, "PUT", {
          student_code: form.student_code,
          full_name: form.full_name,
          email: form.email || null,
          dob: form.dob || null,
          class_name: form.class_name || null,
        });
      } else {
        await apiSend("/api/students", "POST", {
          student_code: form.student_code,
          full_name: form.full_name,
          email: form.email || null,
          dob: form.dob || null,
          class_name: form.class_name || null,
        });
      }
      resetForm();
      await load();
    } catch (e2) {
      setError(String(e2));
    }
  }

  async function remove(id) {
    if (!confirm("Xoá sinh viên này?")) return;
    setError("");
    try {
      await apiSend(`/api/students/${id}`, "DELETE", {});
      if (form.id === id) resetForm();
      await load();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Student Manager - v2.0.5</h1>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <div className="grid">
        <section className="card">
          <h2>{isEdit ? "Cập nhật sinh viên" : "Thêm sinh viên"}</h2>
          <form onSubmit={submit} className="form">
            <label>
              Mã SV (student_code) *
              <input name="student_code" value={form.student_code} onChange={onChange} />
            </label>
            <label>
              Họ tên (full_name) *
              <input name="full_name" value={form.full_name} onChange={onChange} />
            </label>
            <label>
              Email
              <input name="email" value={form.email} onChange={onChange} />
            </label>
            <label>
              Ngày sinh (dob)
              <input type="date" name="dob" value={form.dob} onChange={onChange} />
            </label>
            <label>
              Lớp (class_name)
              <input name="class_name" value={form.class_name} onChange={onChange} />
            </label>

            <div className="row">
              <button type="submit">{isEdit ? "Lưu" : "Tạo mới"}</button>
              <button type="button" className="secondary" onClick={resetForm}>
                Reset
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Danh sách sinh viên</h2>
          <div className="toolbar">
            <input
              className="search"
              placeholder="Tìm theo tên (full_name)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="secondary" type="button" onClick={() => { setQuery(""); }}>
              Xoá lọc
            </button>
          </div>
          {loading ? (
            <div>Đang tải...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Mã SV</th>
                  <th>Họ tên</th>
                  <th>Lớp</th>
                  <th>Email</th>
                  <th>Ngày sinh</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.student_code}</td>
                    <td>{s.full_name}</td>
                    <td>{s.class_name || "-"}</td>
                    <td>{s.email || "-"}</td>
                    <td>{s.dob ? String(s.dob).slice(0, 10) : "-"}</td>
                    <td className="actions">
                      <button className="secondary" onClick={() => pickStudent(s)}>
                        Sửa
                      </button>
                      <button className="danger" onClick={() => remove(s.id)}>
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
                {!students.length ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center" }}>
                      Chưa có dữ liệu
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
