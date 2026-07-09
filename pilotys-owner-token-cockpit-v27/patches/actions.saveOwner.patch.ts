// Patch for app/admin/owners/actions.ts
// 1) Import randomUUID is already present in your file.
// 2) Add this helper near optionalText/integerValue:

function ownerPublicToken() {
  return randomUUID().replaceAll("-", "");
}

// 3) Add public_token only on insert.
// In saveOwner(), replace the current insert branch:
//
//   .insert(payload)
//
// with:
//
//   .insert({
//     ...payload,
//     public_token: ownerPublicToken(),
//   })
//
// Keep the update branch unchanged so existing owner links do not rotate unexpectedly.
