export const SWIFT_FUNCTION_QUERY = `
  (function_declaration
    name: (simple_identifier) @name
    (parameter) @params
    (function_body) @body
  ) @function

  (init_declaration
    (parameter) @params
    body: (function_body) @body
  ) @method
`;

export const SWIFT_CLASS_QUERY = `
  (class_declaration
    name: (type_identifier) @name
    (inheritance_specifier)? @supers
    body: (class_body)? @body
  ) @class

  (protocol_declaration
    name: (type_identifier) @name
    body: (protocol_body)? @body
  ) @protocol

  (struct_declaration
    name: (type_identifier) @name
    body: (class_body)? @body
  ) @struct

  (enum_declaration
    name: (type_identifier) @name
    body: (enum_class_body)? @body
  ) @enum
`;

export const SWIFT_IMPORT_QUERY = `
  (import_declaration
    (identifier) @imported
  ) @import
`;

export const SWIFT_CALL_QUERY = `
  (call_expression
    (simple_identifier) @callee
    (call_suffix) @args
  ) @call

  (call_expression
    (navigation_expression
      (_) @receiver
      (navigation_suffix
        (simple_identifier) @callee
      )
    )
    (call_suffix) @args
  ) @call
`;
