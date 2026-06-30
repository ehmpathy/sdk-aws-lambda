# self-review: has-clear-instructions

## verdict: holds

## assessment

### can the foreman follow without prior context?

yes. each step includes:
- clear citation to the acceptance test case
- explicit context about what the test verifies
- no assumed knowledge beyond prerequisites section

### are commands copy-pasteable?

yes. every action block contains:
```bash
npm run test:acceptance -- --testNamePattern="caseN.*pattern"
```
- standard npm syntax
- explicit test name pattern
- no shell expansion or variable substitution needed

### are expected outcomes explicit?

yes. each step specifies:
- what the test should produce (pass, snapshot content)
- specific fields to verify (e.g., `input.properties.name`)
- error conditions when applicable (e.g., `errorType: 'BadRequestError'`)

### verification

ran full acceptance suite to verify all 9 happy path tests pass:
```
rhx git.repo.test --what acceptance --against local --env test --scope introspection --mode apply
```
result: 113 tests passed, 0 failed

## why it holds

the playtest follows the required structure:
1. prerequisites section with keyrack unlock command
2. sandbox section that states no file operations needed
3. each test has action, expected outcome, and pass criteria
4. all steps cite the specific acceptance test case
5. full suite verification step at the end

the foreman can walk through each step independently and verify the introspection behavior works as documented.
