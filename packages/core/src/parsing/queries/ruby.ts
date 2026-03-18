export const RUBY_METHOD_QUERY = `
  (method
    name: (identifier) @name
    parameters: (method_parameters)? @params
    body: (_)? @body
  ) @method

  (singleton_method
    object: (_) @receiver
    name: (identifier) @name
    parameters: (method_parameters)? @params
    body: (_)? @body
  ) @method
`;

export const RUBY_CLASS_QUERY = `
  (class
    name: (constant) @name
    superclass: (superclass)? @extends
    body: (_)? @body
  ) @class

  (module
    name: (constant) @name
    body: (_)? @body
  ) @module
`;

export const RUBY_IMPORT_QUERY = `
  (call
    method: (identifier) @method_name
    arguments: (argument_list
      (string
        (string_content) @imported
      )
    )
    (#match? @method_name "^(require|require_relative|load)$")
  ) @import
`;

export const RUBY_CALL_QUERY = `
  (call
    method: (identifier) @callee
    arguments: (argument_list)? @args
  ) @call

  (call
    receiver: (_) @receiver
    method: (identifier) @callee
    arguments: (argument_list)? @args
  ) @call
`;
