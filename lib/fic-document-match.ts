// A shared order subject is readable, but is not a unique document identifier.
// When recovering an uncertain request, also verify its date and complete lines.
export function matchesRequestedDocument(document: any, request: any): boolean {
  if (document.type !== request.type || document.subject !== request.subject || document.entity?.id !== request.entity?.id || document.date !== request.date) return false;
  if (!Array.isArray(document.items_list) || document.items_list.length !== request.items_list?.length) return false;
  return request.items_list.every((line: any, index: number) => {
    const actual = document.items_list[index];
    return actual.name === line.name && Number(actual.qty) === Number(line.qty) &&
      Math.abs(Number(actual.net_price) - Number(line.net_price)) < 0.000001;
  });
}
