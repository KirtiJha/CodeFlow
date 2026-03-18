export const PHP_FUNCTION_QUERY = `
  (function_definition
    name: (name) @name
    parameters: (formal_parameters) @params
    body: (compound_statement) @body
  ) @function

  (method_declaration
    name: (name) @name
    parameters: (formal_parameters) @params
    body: (compound_statement) @body
  ) @method
`;

export const PHP_CLASS_QUERY = `
  (class_declaration
    name: (name) @name
    (base_clause)? @extends
    (class_interface_clause)? @implements
    body: (declaration_list) @body
  ) @class

  (interface_declaration
    name: (name) @name
    body: (declaration_list) @body
  ) @interface
`;

export const PHP_IMPORT_QUERY = `
  (namespace_use_declaration
    (namespace_use_clause
      (qualified_name) @imported
    )
  ) @import
`;

export const PHP_CALL_QUERY = `
  (function_call_expression
    function: (name) @callee
    arguments: (arguments) @args
  ) @call

  (member_call_expression
    object: (_) @receiver
    name: (name) @callee
    arguments: (arguments) @args
  ) @call

  (scoped_call_expression
    scope: (_) @receiver
    name: (name) @callee
    arguments: (arguments) @args
  ) @call

  (object_creation_expression
    (qualified_name) @callee
    arguments: (arguments)? @args
  ) @call
`;
