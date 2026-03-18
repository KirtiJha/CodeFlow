export const CSHARP_METHOD_QUERY = `
  (method_declaration
    returns: (_) @return_type
    name: (identifier) @name
    parameters: (parameter_list) @params
    body: (block) @body
  ) @method

  (constructor_declaration
    name: (identifier) @name
    parameters: (parameter_list) @params
    body: (block) @body
  ) @method
`;

export const CSHARP_CLASS_QUERY = `
  (class_declaration
    name: (identifier) @name
    bases: (base_list)? @bases
    body: (declaration_list) @body
  ) @class

  (interface_declaration
    name: (identifier) @name
    body: (declaration_list) @body
  ) @interface
`;

export const CSHARP_IMPORT_QUERY = `
  (using_directive
    (identifier) @imported
  ) @import

  (using_directive
    (qualified_name) @imported
  ) @import
`;

export const CSHARP_CALL_QUERY = `
  (invocation_expression
    function: (identifier) @callee
    arguments: (argument_list) @args
  ) @call

  (invocation_expression
    function: (member_access_expression
      expression: (_) @receiver
      name: (identifier) @callee
    )
    arguments: (argument_list) @args
  ) @call

  (object_creation_expression
    type: (identifier) @callee
    arguments: (argument_list)? @args
  ) @call
`;
