/**
 * Tree-sitter query patterns for Java.
 */

export const JAVA_METHOD_QUERY = `
  (method_declaration
    (modifiers)? @modifiers
    type: (_) @return_type
    name: (identifier) @name
    parameters: (formal_parameters) @params
    body: (block) @body
  ) @method

  (constructor_declaration
    name: (identifier) @name
    parameters: (formal_parameters) @params
    body: (constructor_body) @body
  ) @method
`;

export const JAVA_CLASS_QUERY = `
  (class_declaration
    name: (identifier) @name
    superclass: (superclass)? @extends
    interfaces: (super_interfaces)? @implements
    body: (class_body) @body
  ) @class

  (interface_declaration
    name: (identifier) @name
    (extends_interfaces)? @extends
    body: (interface_body) @body
  ) @interface

  (enum_declaration
    name: (identifier) @name
    body: (enum_body) @body
  ) @enum
`;

export const JAVA_IMPORT_QUERY = `
  (import_declaration
    (scoped_identifier) @imported
  ) @import
`;

export const JAVA_CALL_QUERY = `
  ;; Static/direct calls
  (method_invocation
    name: (identifier) @callee
    arguments: (argument_list) @args
  ) @call

  ;; Instance method calls
  (method_invocation
    object: (_) @receiver
    name: (identifier) @callee
    arguments: (argument_list) @args
  ) @call

  ;; Constructor calls
  (object_creation_expression
    type: (type_identifier) @callee
    arguments: (argument_list) @args
  ) @call
`;

export const JAVA_FIELD_QUERY = `
  (field_declaration
    (modifiers)? @modifiers
    type: (_) @type
    declarator: (variable_declarator
      name: (identifier) @name
    )
  ) @field
`;

export const JAVA_ANNOTATION_QUERY = `
  (marker_annotation
    name: (identifier) @name
  ) @annotation

  (annotation
    name: (identifier) @name
    arguments: (annotation_argument_list) @args
  ) @annotation
`;
