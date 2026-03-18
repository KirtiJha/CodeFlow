/**
 * Tree-sitter query patterns for Go.
 */

export const GO_FUNCTION_QUERY = `
  ;; Regular function
  (function_declaration
    name: (identifier) @name
    parameters: (parameter_list) @params
    result: (_)? @return_type
    body: (block) @body
  ) @function

  ;; Method (function with receiver)
  (method_declaration
    receiver: (parameter_list) @receiver
    name: (field_identifier) @name
    parameters: (parameter_list) @params
    result: (_)? @return_type
    body: (block) @body
  ) @method
`;

export const GO_STRUCT_QUERY = `
  (type_declaration
    (type_spec
      name: (type_identifier) @name
      type: (struct_type
        (field_declaration_list) @fields
      )
    )
  ) @struct
`;

export const GO_INTERFACE_QUERY = `
  (type_declaration
    (type_spec
      name: (type_identifier) @name
      type: (interface_type) @body
    )
  ) @interface
`;

export const GO_IMPORT_QUERY = `
  (import_declaration
    (import_spec
      name: (identifier)? @alias
      path: (interpreted_string_literal) @source
    )
  ) @import

  (import_declaration
    (import_spec_list
      (import_spec
        name: (identifier)? @alias
        path: (interpreted_string_literal) @source
      )
    )
  ) @import
`;

export const GO_CALL_QUERY = `
  ;; Direct function call
  (call_expression
    function: (identifier) @callee
    arguments: (argument_list) @args
  ) @call

  ;; Method/package call
  (call_expression
    function: (selector_expression
      operand: (_) @receiver
      field: (field_identifier) @callee
    )
    arguments: (argument_list) @args
  ) @call
`;
