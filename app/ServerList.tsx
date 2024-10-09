export default function ServerList() {
  return (
    <div
      className="table-responsive text-center border rounded border-primary"
      id="server-table"
    >
      <table className="table table-striped table-hover mb-0">
        <thead>
          <tr>
            <th>Description</th>
            <th>Game Version</th>
          </tr>
        </thead>
        <tbody id="server-tablebody">
          <tr id="server-listing-placeholder">
            <td colSpan={2}>
              No servers added yet... perhaps you should find one?
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
