/**
 * Tree-sitter query patterns for TypeScript/JavaScript.
 * These patterns capture functions, classes, methods, imports, exports, and calls.
 */

export const TS_FUNCTION_QUERY = `
  ;; Named function declarations
  (function_declaration
    name: (identifier) @name
    parameters: (formal_parameters) @params
    return_type: (type_annotation)? @return_type
    body: (statement_block) @body
  ) @function

  ;; Arrow functions assigned to variables
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (arrow_function
        parameters: (formal_parameters) @params
        return_type: (type_annotation)? @return_type
        body: (_) @body
      )
    )
  ) @function

  ;; Exported function declarations
  (export_statement
    (function_declaration
      name: (identifier) @name
      parameters: (formal_parameters) @params
      return_type: (type_annotation)? @return_type
      body: (statement_block) @body
    )
  ) @function
`;

export const TS_CLASS_QUERY = `
  (class_declaration
    name: (type_identifier) @name
    (class_heritage)? @heritage
    body: (class_body) @body
  ) @class

  (export_statement
    (class_declaration
      name: (type_identifier) @name
      (class_heritage)? @heritage
      body: (class_body) @body
    )
  ) @class
`;

export const TS_METHOD_QUERY = `
  (method_definition
    name: (property_identifier) @name
    parameters: (formal_parameters) @params
    return_type: (type_annotation)? @return_type
    body: (statement_block) @body
  ) @method
`;

export const TS_IMPORT_QUERY = `
  ;; Named imports
  (import_statement
    (import_clause
      (named_imports
        (import_specifier
          name: (identifier) @imported
          alias: (identifier)? @alias
        )
      )
    )
    source: (string) @source
  ) @import

  ;; Default imports
  (import_statement
    (import_clause
      (identifier) @imported
    )
    source: (string) @source
  ) @import

  ;; Namespace imports
  (import_statement
    (import_clause
      (namespace_import
        (identifier) @imported
      )
    )
    source: (string) @source
  ) @import
`;

export const TS_EXPORT_QUERY = `
  ;; Named exports
  (export_statement
    (export_clause
      (export_specifier
        name: (identifier) @exported
        alias: (identifier)? @alias
      )
    )
  ) @export

  ;; Default export
  (export_statement
    value: (_) @exported
  ) @export
`;

export const TS_CALL_QUERY = `
  ;; Direct function calls
  (call_expression
    function: (identifier) @callee
    arguments: (arguments) @args
  ) @call

  ;; Method calls
  (call_expression
    function: (member_expression
      object: (_) @receiver
      property: (property_identifier) @callee
    )
    arguments: (arguments) @args
  ) @call

  ;; new Foo() calls
  (new_expression
    constructor: (identifier) @callee
    arguments: (arguments)? @args
  ) @call
`;

export const TS_INTERFACE_QUERY = `
  (interface_declaration
    name: (type_identifier) @name
    body: (interface_body) @body
  ) @interface

  (type_alias_declaration
    name: (type_identifier) @name
    value: (_) @body
  ) @type_alias
`;
