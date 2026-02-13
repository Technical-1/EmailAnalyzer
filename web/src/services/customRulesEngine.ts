import type { Email, CustomRule, RuleCondition, RuleAction } from '../types';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'email-analyzer-custom-rules';

/**
 * Engine for evaluating and applying custom user-defined rules
 */
class CustomRulesEngine {
  /**
   * Get all custom rules
   */
  getRules(): CustomRule[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      
      const rules = JSON.parse(data) as CustomRule[];
      return rules.map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt),
      }));
    } catch (error) {
      logger.error('Failed to load custom rules:', error);
      return [];
    }
  }

  /**
   * Get active rules only
   */
  getActiveRules(): CustomRule[] {
    return this.getRules().filter((r) => r.isActive);
  }

  /**
   * Create a new rule
   */
  createRule(rule: Omit<CustomRule, 'id' | 'createdAt'>): CustomRule {
    const rules = this.getRules();
    
    const newRule: CustomRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    rules.push(newRule);
    this.persist(rules);
    
    return newRule;
  }

  /**
   * Update an existing rule
   */
  updateRule(id: string, updates: Partial<Omit<CustomRule, 'id' | 'createdAt'>>): void {
    const rules = this.getRules();
    const index = rules.findIndex((r) => r.id === id);
    
    if (index !== -1) {
      rules[index] = { ...rules[index], ...updates };
      this.persist(rules);
    }
  }

  /**
   * Delete a rule
   */
  deleteRule(id: string): void {
    const rules = this.getRules().filter((r) => r.id !== id);
    this.persist(rules);
  }

  /**
   * Toggle rule active status
   */
  toggleRule(id: string): void {
    const rules = this.getRules();
    const rule = rules.find((r) => r.id === id);
    
    if (rule) {
      rule.isActive = !rule.isActive;
      this.persist(rules);
    }
  }

  /**
   * Evaluate all rules against an email and return matching actions
   */
  evaluateEmail(email: Email): RuleAction[] {
    const matchedActions: RuleAction[] = [];
    const activeRules = this.getActiveRules();

    for (const rule of activeRules) {
      if (this.matchesRule(email, rule)) {
        matchedActions.push(...rule.actions);
      }
    }

    return matchedActions;
  }

  /**
   * Check if an email matches a rule's conditions
   */
  matchesRule(email: Email, rule: CustomRule): boolean {
    // All conditions must match (AND logic)
    return rule.conditions.every((condition) => 
      this.matchesCondition(email, condition)
    );
  }

  /**
   * Check if an email matches a single condition
   */
  matchesCondition(email: Email, condition: RuleCondition): boolean {
    let fieldValue: string;

    switch (condition.field) {
      case 'sender':
        fieldValue = email.sender + (email.senderName ? ` ${email.senderName}` : '');
        break;
      case 'subject':
        fieldValue = email.subject;
        break;
      case 'body':
        fieldValue = email.body;
        break;
      case 'recipient':
        fieldValue = email.recipients.join(' ');
        break;
      default:
        return false;
    }

    const compareValue = condition.caseSensitive 
      ? fieldValue 
      : fieldValue.toLowerCase();
    const searchValue = condition.caseSensitive 
      ? condition.value 
      : condition.value.toLowerCase();

    switch (condition.operator) {
      case 'contains':
        return compareValue.includes(searchValue);
      case 'equals':
        return compareValue === searchValue;
      case 'startsWith':
        return compareValue.startsWith(searchValue);
      case 'endsWith':
        return compareValue.endsWith(searchValue);
      case 'regex':
        try {
          const flags = condition.caseSensitive ? '' : 'i';
          const regex = new RegExp(condition.value, flags);
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Parse a simple rule string (for quick rule creation)
   * Format: "IF sender contains 'bank' AND subject contains 'statement' THEN tag 'Bank Statement'"
   */
  parseRuleString(ruleString: string): CustomRule | null {
    try {
      const ifMatch = ruleString.match(/IF\s+(.+?)\s+THEN\s+(.+)/i);
      if (!ifMatch) return null;

      const conditionsPart = ifMatch[1];
      const actionPart = ifMatch[2];

      // Parse conditions
      const conditionStrings = conditionsPart.split(/\s+AND\s+/i);
      const conditions: RuleCondition[] = [];

      for (const condStr of conditionStrings) {
        const match = condStr.match(/(\w+)\s+(contains|equals|startsWith|endsWith|regex)\s+['"](.+?)['"]/i);
        if (match) {
          conditions.push({
            field: match[1].toLowerCase() as RuleCondition['field'],
            operator: match[2].toLowerCase() as RuleCondition['operator'],
            value: match[3],
            caseSensitive: false,
          });
        }
      }

      if (conditions.length === 0) return null;

      // Parse action
      const actions: RuleAction[] = [];
      const tagMatch = actionPart.match(/tag\s+['"](.+?)['"]/i);
      const moveMatch = actionPart.match(/move\s+(?:to\s+)?['"](.+?)['"]/i);
      const starMatch = actionPart.match(/star/i);
      const readMatch = actionPart.match(/mark\s*(?:as\s*)?read/i);

      if (tagMatch) {
        actions.push({ type: 'tag', value: tagMatch[1] });
      }
      if (moveMatch) {
        actions.push({ type: 'move', value: moveMatch[1] });
      }
      if (starMatch) {
        actions.push({ type: 'star' });
      }
      if (readMatch) {
        actions.push({ type: 'markRead' });
      }

      if (actions.length === 0) return null;

      return {
        id: `rule-${Date.now()}`,
        name: `Custom Rule`,
        conditions,
        actions,
        isActive: true,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to parse rule string:', error);
      return null;
    }
  }

  /**
   * Convert a rule to a readable string
   */
  ruleToString(rule: CustomRule): string {
    const conditionStrs = rule.conditions.map((c) => 
      `${c.field} ${c.operator} "${c.value}"`
    );
    
    const actionStrs = rule.actions.map((a) => {
      switch (a.type) {
        case 'tag':
          return `tag "${a.value}"`;
        case 'move':
          return `move to "${a.value}"`;
        case 'star':
          return 'star';
        case 'markRead':
          return 'mark as read';
        default:
          return '';
      }
    });

    return `IF ${conditionStrs.join(' AND ')} THEN ${actionStrs.join(', ')}`;
  }

  /**
   * Persist rules to localStorage
   */
  private persist(rules: CustomRule[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch (error) {
      logger.error('Failed to save custom rules:', error);
    }
  }
}

export const customRulesEngine = new CustomRulesEngine();

