export const RUST_FUNCTION_QUERY = `
  (function_item
    name: (identifier) @name
    parameters: (parameters) @params
    return_type: (_)? @return_type
    body: (block) @body
  ) @function

  (impl_item
    type: (type_identifier) @impl_type
    body: (declaration_list) @body
  ) @impl
`;

export const RUST_STRUCT_QUERY = `
  (struct_item
    name: (type_identifier) @name
    body: (field_declaration_list)? @fields
  ) @struct

  (enum_item
    name: (type_identifier) @name
    body: (enum_variant_list) @variants
  ) @enum
`;

export const RUST_IMPORT_QUERY = `
  (use_declaration
    argument: (_) @import_path
  ) @import
`;

export const RUST_CALL_QUERY = `
  (call_expression
    function: (identifier) @callee
    arguments: (arguments) @args
  ) @call

  (call_expression
    function: (field_expression
      value: (_) @receiver
      field: (field_identifier) @callee
    )
    arguments: (arguments) @args
  ) @call

  (call_expression
    function: (scoped_identifier) @callee
    arguments: (arguments) @args
  ) @call
`;

export const RUST_TRAIT_QUERY = `
  (trait_item
    name: (type_identifier) @name
    body: (declaration_list) @body
  ) @trait
`;
