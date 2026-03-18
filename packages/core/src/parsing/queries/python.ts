/**
 * Tree-sitter query patterns for Python.
 */

export const PY_FUNCTION_QUERY = `
  (function_definition
    name: (identifier) @name
    parameters: (parameters) @params
    return_type: (type)? @return_type
    body: (block) @body
  ) @function

  (decorated_definition
    (function_definition
      name: (identifier) @name
      parameters: (parameters) @params
      return_type: (type)? @return_type
      body: (block) @body
    )
  ) @function
`;

export const PY_CLASS_QUERY = `
  (class_definition
    name: (identifier) @name
    superclasses: (argument_list)? @bases
    body: (block) @body
  ) @class

  (decorated_definition
    (class_definition
      name: (identifier) @name
      superclasses: (argument_list)? @bases
      body: (block) @body
    )
  ) @class
`;

export const PY_IMPORT_QUERY = `
  ;; import module
  (import_statement
    name: (dotted_name) @imported
  ) @import

  ;; from module import name
  (import_from_statement
    module_name: (dotted_name) @source
    name: (dotted_name) @imported
  ) @import

  ;; from module import name as alias
  (import_from_statement
    module_name: (dotted_name) @source
    name: (aliased_import
      name: (dotted_name) @imported
      alias: (identifier) @alias
    )
  ) @import
`;

export const PY_CALL_QUERY = `
  ;; Direct calls
  (call
    function: (identifier) @callee
    arguments: (argument_list) @args
  ) @call

  ;; Method calls
  (call
    function: (attribute
      object: (_) @receiver
      attribute: (identifier) @callee
    )
    arguments: (argument_list) @args
  ) @call
`;

export const PY_DECORATOR_QUERY = `
  (decorator
    (identifier) @name
  ) @decorator

  (decorator
    (call
      function: (identifier) @name
      arguments: (argument_list) @args
    )
  ) @decorator

  (decorator
    (attribute
      object: (_) @object
      attribute: (identifier) @name
    )
  ) @decorator
`;
