// C++ inherits from C and adds:
export { C_FUNCTION_QUERY as CPP_FUNCTION_QUERY } from "./c.js";
export { C_STRUCT_QUERY } from "./c.js";
export { C_IMPORT_QUERY } from "./c.js";
export { C_CALL_QUERY } from "./c.js";

export const CPP_CLASS_QUERY = `
  (class_specifier
    name: (type_identifier) @name
    (base_class_clause)? @bases
    body: (field_declaration_list) @body
  ) @class
`;

export const CPP_NAMESPACE_QUERY = `
  (namespace_definition
    name: (identifier) @name
    body: (declaration_list) @body
  ) @namespace
`;

export const CPP_TEMPLATE_QUERY = `
  (template_declaration
    parameters: (template_parameter_list) @params
    (function_definition)? @function
    (class_specifier)? @class
  ) @template
`;
