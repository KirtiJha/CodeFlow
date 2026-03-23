import Parser from 'tree-sitter';
import TreeSitterTS from 'tree-sitter-typescript';

const parser = new Parser();
parser.setLanguage(TreeSitterTS.typescript);

const code = `
interface User {
  id: string;
  email?: string;
  roles: string[];
  getDisplayName(): string;
  readonly createdAt: Date;
}

class UserService {
  private db: Database;
  public name: string = "test";
  protected count = 0;
}

enum Status {
  Active = "active",
  Inactive = "inactive",
}
`;

const tree = parser.parse(code);

function findAll(node, type) {
  const results = [];
  if (node.type === type) results.push(node);
  for (let i = 0; i < node.namedChildCount; i++) {
    results.push(...findAll(node.namedChild(i), type));
  }
  return results;
}

console.log("=== Property Signatures (interface fields) ===");
for (const ps of findAll(tree.rootNode, 'property_signature')) {
  const name = ps.childForFieldName('name');
  const type = ps.childForFieldName('type');
  console.log({
    name: name?.text,
    type: type?.text,
    optional: ps.text.includes('?'),
    readonly: ps.text.startsWith('readonly'),
    fullText: ps.text,
    children: [...Array(ps.namedChildCount)].map((_, i) => ({ type: ps.namedChild(i).type, text: ps.namedChild(i).text })),
  });
}

console.log("\n=== Method Signatures (interface methods) ===");
for (const ms of findAll(tree.rootNode, 'method_signature')) {
  const name = ms.childForFieldName('name');
  const params = ms.childForFieldName('parameters');
  const returnType = ms.childForFieldName('return_type');
  console.log({
    name: name?.text,
    params: params?.text,
    returnType: returnType?.text,
  });
}

console.log("\n=== Public Field Definitions (class properties) ===");
for (const pf of findAll(tree.rootNode, 'public_field_definition')) {
  const name = pf.childForFieldName('name');
  const type = pf.childForFieldName('type');
  const value = pf.childForFieldName('value');
  const acc = pf.children.find(c => ['private', 'public', 'protected'].includes(c.type));
  console.log({
    name: name?.text,
    type: type?.text,
    value: value?.text,
    accessibility: acc?.type,
    fullText: pf.text,
  });
}

console.log("\n=== Enum Assignments ===");
for (const ea of findAll(tree.rootNode, 'enum_assignment')) {
  const name = ea.childForFieldName('name');
  const value = ea.childForFieldName('value');
  console.log({ name: name?.text, value: value?.text });
}
