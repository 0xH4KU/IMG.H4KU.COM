## Summary

<!-- Brief description of the changes -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring (no functional changes)
- [ ] Documentation
- [ ] Configuration / CI

## Checklist

### Security
- [ ] No hardcoded secrets, tokens, or passwords
- [ ] User input is validated at system boundaries
- [ ] No new path traversal vulnerabilities
- [ ] Reserved paths (`.config/`, `.thumbs/`) are protected

### Testing
- [ ] Type check passes (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)
- [ ] Tests pass (`npm run test`)
- [ ] Manually tested the affected functionality

### Error Handling
- [ ] API errors are caught and displayed to the user
- [ ] No silent `catch` blocks that hide errors
- [ ] 401 errors trigger logout flow

### Code Quality
- [ ] No duplicate code (DRY principle)
- [ ] Functions are focused and well-named
- [ ] No unused imports or variables
- [ ] No `any` types unless absolutely necessary

### Documentation
- [ ] Updated relevant documentation if needed
- [ ] Added JSDoc comments for new public functions
- [ ] Updated CHANGELOG if significant changes

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Related Issues

<!-- Link related issues: Fixes #123 -->
