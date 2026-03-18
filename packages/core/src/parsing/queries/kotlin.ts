export const KOTLIN_FUNCTION_QUERY = `
  (function_declaration
    (simple_identifier) @name
    (function_value_parameters) @params
    (function_body) @body
  ) @function
`;

export const KOTLIN_CLASS_QUERY = `
  (class_declaration
    (type_identifier) @name
    (delegation_specifiers)? @supers
    (class_body)? @body
  ) @class

  (object_declaration
    (type_identifier) @name
    (class_body)? @body
  ) @object
`;

export const KOTLIN_IMPORT_QUERY = `
  (import_header
    (identifier) @imported
  ) @import
`;

export const KOTLIN_CALL_QUERY = `
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
