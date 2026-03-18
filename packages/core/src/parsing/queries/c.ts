export const C_FUNCTION_QUERY = `
  (function_definition
    type: (_) @return_type
    declarator: (function_declarator
      declarator: (identifier) @name
      parameters: (parameter_list) @params
    )
    body: (compound_statement) @body
  ) @function
`;

export const C_STRUCT_QUERY = `
  (struct_specifier
    name: (type_identifier) @name
    body: (field_declaration_list) @fields
  ) @struct

  (enum_specifier
    name: (type_identifier) @name
    body: (enumerator_list) @values
  ) @enum
`;

export const C_IMPORT_QUERY = `
  (preproc_include
    path: (string_literal) @imported
  ) @import

  (preproc_include
    path: (system_lib_string) @imported
  ) @import
`;

export const C_CALL_QUERY = `
  (call_expression
    function: (identifier) @callee
    arguments: (argument_list) @args
  ) @call

  (call_expression
    function: (field_expression
      argument: (_) @receiver
      field: (field_identifier) @callee
    )
    arguments: (argument_list) @args
  ) @call
`;
