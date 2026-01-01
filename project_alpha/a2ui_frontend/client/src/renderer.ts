/**
 * A2UI Renderer - Renders A2UI components to DOM
 */
import { LitElement, html, css, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Component, BoundValue, Action, Children, ExplicitChildren } from './types';
import { DataModel } from './data-model';

/**
 * Main A2UI Surface element
 */
@customElement('a2ui-surface')
export class A2UISurface extends LitElement {
  @property({ type: String }) surfaceId = 'main';
  @state() private components: Map<string, Component> = new Map();
  @state() private rootId: string | null = null;

  dataModel: DataModel = new DataModel();

  private actionHandler: ((action: Action, sourceId: string, contextPath?: string) => void) | null = null;

  static styles = css`
    :host {
      display: block;
    }
  `;

  setComponents(components: Component[]): void {
    this.components.clear();
    for (const comp of components) {
      this.components.set(comp.id, comp);
    }
    this.requestUpdate();
  }

  setRoot(rootId: string): void {
    this.rootId = rootId;
    this.requestUpdate();
  }

  setActionHandler(handler: (action: Action, sourceId: string, contextPath?: string) => void): void {
    this.actionHandler = handler;
  }

  handleAction(action: Action, sourceId: string, contextPath?: string): void {
    console.log(`[A2UISurface] handleAction called: ${action.name} from ${sourceId}`);
    
    // Log current data model state for debugging
    if (action.name === 'search_tickets') {
      const searchPath = '/app/tickets/query/search';
      const searchValue = this.dataModel.get(searchPath);
      console.log(`[A2UISurface] Before action, DataModel ${searchPath} = "${searchValue}"`);
      console.log(`[A2UISurface] Full DataModel dump:`, this.dataModel.dump());
    }
    
    if (this.actionHandler) {
      this.actionHandler(action, sourceId, contextPath);
    }
  }

  render() {
    if (!this.rootId) {
      return html`<slot></slot>`;
    }

    const rootComponent = this.components.get(this.rootId);
    if (!rootComponent) {
      return html`<div class="error">Root component not found: ${this.rootId}</div>`;
    }

    return this.renderComponent(rootComponent);
  }

  private renderComponent(comp: Component, contextPath?: string): TemplateResult | typeof nothing {
    const componentType = Object.keys(comp.component)[0];
    const props = comp.component[componentType] as Record<string, unknown>;

    switch (componentType) {
      case 'Text':
        return this.renderText(comp.id, props, contextPath);
      case 'Button':
        return this.renderButton(comp.id, props, contextPath);
      case 'TextField':
        return this.renderTextField(comp.id, props, contextPath);
      case 'Column':
        return this.renderColumn(comp.id, props, contextPath);
      case 'Row':
        return this.renderRow(comp.id, props, contextPath);
      case 'Card':
        return this.renderCard(comp.id, props, contextPath);
      case 'List':
        return this.renderList(comp.id, props, contextPath);
      case 'Icon':
        return this.renderIcon(comp.id, props, contextPath);
      case 'Divider':
        return this.renderDivider(comp.id);
      case 'Modal':
        return this.renderModal(comp.id, props, contextPath);
      case 'CheckBox':
        return this.renderCheckBox(comp.id, props, contextPath);
      case 'MultiSelect':
        return this.renderMultiSelect(comp.id, props, contextPath);
      default:
        console.warn(`Unknown component type: ${componentType}`);
        return html`<div class="unknown-component">[${componentType}]</div>`;
    }
  }

  private resolveValue(value: BoundValue | undefined, contextPath?: string): unknown {
    if (!value) return undefined;
    return this.dataModel.resolve(value, contextPath);
  }

  private renderText(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const text = this.resolveValue(props.text as BoundValue, contextPath) ?? '';
    const usageHint = props.usageHint as string | undefined;
    
    // Detect special text types for styling
    const isStatusText = id === 'ticket-item-status';
    const isPriorityText = id === 'ticket-item-priority';
    const isTagsText = id === 'ticket-item-tags';
    const isDateText = id === 'ticket-item-date';
    const isBadge = isStatusText || isPriorityText;

    // Don't render tags text if empty
    if (isTagsText && !text) {
      return html``;
    }

    return html`
      <a2ui-text
        id=${id}
        data-usage-hint=${usageHint || nothing}
        data-badge=${isBadge ? 'true' : nothing}
        data-status=${isStatusText ? 'true' : nothing}
        data-priority=${isPriorityText ? 'true' : nothing}
        data-tags=${isTagsText ? 'true' : nothing}
        data-date=${isDateText ? 'true' : nothing}
      >${text}</a2ui-text>
    `;
  }

  private renderButton(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const childId = props.child as string;
    const action = props.action as Action;

    const handleClick = () => {
      console.log(`[Button ${id}] clicked, action:`, action);
      if (action) {
        // Pass contextPath so relative paths in action.context can be resolved
        this.handleAction(action, id, contextPath);
      } else {
        console.warn(`[Button ${id}] No action defined!`);
      }
    };

    // Check if this is a filter button, form priority button, tag color button, or form tag button
    const isFilterButton = id.startsWith('filter-') || id.startsWith('priority-');
    const isFormPriorityButton = id.startsWith('create-priority-') || id.startsWith('edit-priority-');
    const isTagColorButton = id.startsWith('tag-color-');
    const isFormTagButton = id.startsWith('create-tag-') || id.startsWith('edit-tag-');
    const isSelectableButton = isFilterButton || isFormPriorityButton || isTagColorButton || isFormTagButton;
    
    // Check if this button is currently selected
    let isSelected = false;
    if (isFilterButton) {
      const currentStatus = this.dataModel.get('/app/tickets/query/status') as string || '';
      const currentPriority = this.dataModel.get('/app/tickets/query/priority') as string || '';
      
      // Status filter buttons
      if (id === 'filter-all' && currentStatus === '') isSelected = true;
      else if (id === 'filter-open' && currentStatus === 'open') isSelected = true;
      else if (id === 'filter-progress' && currentStatus === 'in_progress') isSelected = true;
      else if (id === 'filter-completed' && currentStatus === 'completed') isSelected = true;
      else if (id === 'filter-cancelled' && currentStatus === 'cancelled') isSelected = true;
      
      // Priority filter buttons
      else if (id === 'priority-all' && currentPriority === '') isSelected = true;
      else if (id === 'priority-low' && currentPriority === 'low') isSelected = true;
      else if (id === 'priority-medium' && currentPriority === 'medium') isSelected = true;
      else if (id === 'priority-high' && currentPriority === 'high') isSelected = true;
      else if (id === 'priority-urgent' && currentPriority === 'urgent') isSelected = true;
    } else if (isFormPriorityButton) {
      // Form priority buttons (create/edit ticket forms)
      const isEditForm = id.startsWith('edit-priority-');
      const formPath = isEditForm ? '/app/form/edit/priority' : '/app/form/create/priority';
      const currentFormPriority = this.dataModel.get(formPath) as string || 'medium';
      
      // Extract priority value from button id (e.g., 'create-priority-low' -> 'low')
      const buttonPriority = id.replace('create-priority-', '').replace('edit-priority-', '');
      isSelected = buttonPriority === currentFormPriority;
    } else if (isTagColorButton) {
      // Tag color buttons
      const currentColor = this.dataModel.get('/app/tags/form/color') as string || '#3B82F6';
      
      // Map button id to color value
      const colorMap: Record<string, string> = {
        'tag-color-blue': '#3B82F6',
        'tag-color-green': '#10B981',
        'tag-color-yellow': '#F59E0B',
        'tag-color-red': '#EF4444',
        'tag-color-purple': '#8B5CF6',
      };
      isSelected = colorMap[id] === currentColor;
    } else if (isFormTagButton) {
      // Form tag selection buttons (multi-select)
      const isEditForm = id.startsWith('edit-tag-');
      const formPath = isEditForm ? '/app/form/edit/selectedTagIds' : '/app/form/create/selectedTagIds';
      const selectedTagIds = (this.dataModel.get(formPath) as string) || '';
      
      // Get tag ID from action context
      const actionContext = action?.context || [];
      const tagIdEntry = actionContext.find((c: { key: string }) => c.key === 'tagId');
      if (tagIdEntry && 'literalString' in tagIdEntry.value) {
        const tagId = tagIdEntry.value.literalString;
        isSelected = selectedTagIds.split(',').includes(tagId);
      }
    }

    // Check if this is a ticket item button
    const isTicketButton = id === 'ticket-item-btn';

    return html`
      <a2ui-button 
        id=${id} 
        data-filter-button=${isSelectableButton ? 'true' : nothing} 
        data-selected=${isSelected ? 'true' : nothing}
        data-ticket-button=${isTicketButton ? 'true' : nothing}
        @click=${handleClick}
      >
        ${this.renderChildById(childId, contextPath)}
      </a2ui-button>
    `;
  }

  private renderTextField(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const label = this.resolveValue(props.label as BoundValue, contextPath) ?? '';
    const text = this.resolveValue(props.text as BoundValue, contextPath) ?? '';
    const textFieldType = props.textFieldType as string | undefined;
    const isSearchField = id === 'tickets-search';

    // Get the path for this text field
    const textProp = props.text as BoundValue;
    const textPath = textProp && 'path' in textProp ? textProp.path : null;
    
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      console.log(`[TextField ${id}] handleInput called, value: "${target.value}"`);
      
      if (textPath) {
        // Two-way binding: update data model with new value
        this.dataModel.set(textPath, target.value);
        console.log(`[TextField ${id}] DataModel updated: ${textPath} = "${target.value}"`);
        
        // Verify the value was stored
        const storedValue = this.dataModel.get(textPath);
        console.log(`[TextField ${id}] DataModel verification: ${textPath} = "${storedValue}"`);
      } else {
        console.log(`[TextField ${id}] No path binding, value not stored`);
      }
    };

    if (textFieldType === 'multiline') {
      return html`
        <a2ui-textfield id=${id}>
          <textarea
            placeholder=${label}
            .value=${text}
            @input=${handleInput}
            rows="4"
          ></textarea>
        </a2ui-textfield>
      `;
    }

    return html`
      <a2ui-textfield id=${id} data-search-field=${isSearchField ? 'true' : nothing}>
        <input
          type="text"
          placeholder=${label}
          .value=${text}
          @input=${handleInput}
        />
      </a2ui-textfield>
    `;
  }

  private renderColumn(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const children = this.renderChildren(props.children as Children, contextPath);
    const alignment = props.alignment as string | undefined;
    const distribution = props.distribution as string | undefined;
    const isAppLayout = id === 'app-layout';
    const isTicketsList = id === 'tickets-content';

    return html`
      <a2ui-column
        id=${id}
        data-alignment=${alignment || nothing}
        data-distribution=${distribution || nothing}
        data-app-layout=${isAppLayout ? 'true' : nothing}
        data-tickets-list=${isTicketsList ? 'true' : nothing}
      >
        ${children}
      </a2ui-column>
    `;
  }

  private renderRow(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const children = this.renderChildren(props.children as Children, contextPath);
    const alignment = props.alignment as string | undefined;
    const distribution = props.distribution as string | undefined;
    const isSearchRow = id === 'tickets-search-row';
    const isFilterRow = id === 'tickets-status-filters' || id === 'tickets-priority-filters';
    const isMetaRow = id === 'ticket-item-meta';
    const isTicketItemRow = id === 'ticket-item-row';

    return html`
      <a2ui-row
        id=${id}
        data-alignment=${alignment || nothing}
        data-distribution=${distribution || nothing}
        data-search-row=${isSearchRow ? 'true' : nothing}
        data-filter-row=${isFilterRow ? 'true' : nothing}
        data-meta-row=${isMetaRow ? 'true' : nothing}
        data-ticket-row=${isTicketItemRow ? 'true' : nothing}
      >
        ${children}
      </a2ui-row>
    `;
  }

  private renderCard(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const childId = props.child as string;

    // Check if this is a ticket item card (in the list)
    const isTicketCard = id === 'ticket-item-card';

    return html`
      <a2ui-card id=${id} data-ticket-card=${isTicketCard ? 'true' : nothing}>
        ${this.renderChildById(childId, contextPath)}
      </a2ui-card>
    `;
  }

  private renderList(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const children = props.children as Children;
    const direction = props.direction as string || 'vertical';

    let content: unknown;

    if ('template' in children) {
      // Template-based list
      const template = children.template;
      const dataBinding = template.dataBinding;
      const entries = this.dataModel.getEntries(dataBinding);

      content = entries.map(entry => {
        const itemContextPath = entry.path;
        const templateComponent = this.components.get(template.componentId);
        if (templateComponent) {
          return this.renderComponent(templateComponent, itemContextPath);
        }
        return html``;
      });
    } else {
      // Explicit list
      content = this.renderChildren(children, contextPath);
    }

    const isTicketsList = id === 'tickets-list';

    return html`
      <a2ui-list id=${id} data-direction=${direction} data-tickets=${isTicketsList ? 'true' : nothing}>
        ${content}
      </a2ui-list>
    `;
  }

  private renderIcon(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const name = this.resolveValue(props.name as BoundValue, contextPath) ?? '';

    return html`
      <a2ui-icon id=${id}>
        <span class="material-icons">${name}</span>
      </a2ui-icon>
    `;
  }

  private renderDivider(id: string): TemplateResult {
    return html`<a2ui-divider id=${id}></a2ui-divider>`;
  }

  private renderModal(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    // Modal rendering - simplified version
    const entryPointChild = props.entryPointChild as string;
    const contentChild = props.contentChild as string;

    return html`
      <a2ui-modal id=${id}>
        <div slot="entry">${this.renderChildById(entryPointChild, contextPath)}</div>
        <div slot="content">${this.renderChildById(contentChild, contextPath)}</div>
      </a2ui-modal>
    `;
  }

  private renderCheckBox(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const label = this.resolveValue(props.label as BoundValue, contextPath) ?? '';
    const value = this.resolveValue(props.value as BoundValue, contextPath) ?? false;

    return html`
      <a2ui-checkbox id=${id}>
        <label>
          <input type="checkbox" .checked=${Boolean(value)} />
          ${label}
        </label>
      </a2ui-checkbox>
    `;
  }

  private renderMultiSelect(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const label = this.resolveValue(props.label as BoundValue, contextPath) ?? '';
    const options = props.options as Array<{id: string, name: string, color?: string}> || [];
    const selectedPath = props.selectedPath as string || '';
    const actionName = props.actionName as string || 'toggle_multi_select';
    
    // Get currently selected IDs
    const selectedIds = ((this.dataModel.get(selectedPath) as string) || '').split(',').filter(id => id.trim());
    
    const handleToggle = (optionId: string) => {
      const action: Action = {
        name: actionName,
        context: [
          { key: 'optionId', value: { literalString: optionId } },
          { key: 'selectedPath', value: { literalString: selectedPath } },
        ]
      };
      this.handleAction(action, id, contextPath);
    };

    return html`
      <a2ui-multiselect id=${id}>
        <div class="multiselect-label">${label}</div>
        <div class="multiselect-dropdown">
          <button class="multiselect-trigger" type="button">
            ${selectedIds.length > 0 
              ? `已选择 ${selectedIds.length} 项` 
              : '请选择...'}
            <span class="arrow">▼</span>
          </button>
          <div class="multiselect-options">
            ${options.map(opt => {
              const isSelected = selectedIds.includes(opt.id);
              return html`
                <label class="multiselect-option ${isSelected ? 'selected' : ''}" @click=${(e: Event) => { e.preventDefault(); handleToggle(opt.id); }}>
                  <input type="checkbox" .checked=${isSelected} />
                  ${opt.color ? html`<span class="color-dot" style="background: ${opt.color}"></span>` : nothing}
                  <span class="option-name">${opt.name}</span>
                </label>
              `;
            })}
            ${options.length === 0 ? html`<div class="no-options">暂无选项</div>` : nothing}
          </div>
        </div>
      </a2ui-multiselect>
    `;
  }

  private renderChildren(children: Children | undefined, contextPath?: string): unknown {
    if (!children) return nothing;

    if ('explicitList' in children) {
      return (children as ExplicitChildren).explicitList.map(childId =>
        this.renderChildById(childId, contextPath)
      );
    }

    // Template children are handled in renderList
    return nothing;
  }

  private renderChildById(childId: string, contextPath?: string): TemplateResult | typeof nothing {
    const child = this.components.get(childId);
    if (!child) {
      console.warn(`Child component not found: ${childId}`);
      return html``;
    }
    return this.renderComponent(child, contextPath);
  }
}

// Define custom elements for styling (exported to avoid unused warnings)
@customElement('a2ui-text')
export class A2UIText extends LitElement {
  static styles = css`
    :host {
      display: inline;
    }
    :host([data-usage-hint="h1"]) {
      display: block;
      font-size: 36px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 16px;
    }
    :host([data-usage-hint="h2"]) {
      display: block;
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 12px;
    }
    :host([data-usage-hint="h3"]) {
      display: block;
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    :host([data-usage-hint="h4"]) {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    /* Badge styles for status and priority */
    :host([data-badge="true"]) {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 9999px;
      background: #F3F4F6;
      color: #374151;
    }
    :host([data-status="true"]) {
      background: #DBEAFE;
      color: #1E40AF;
    }
    :host([data-priority="true"]) {
      background: #FEF3C7;
      color: #92400E;
    }
    /* Tags text styling */
    :host([data-tags="true"]) {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 400;
      border-radius: 9999px;
      background: #E0E7FF;
      color: #4338CA;
    }
    /* Date text styling */
    :host([data-date="true"]) {
      font-size: 13px;
      color: #9CA3AF;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-button')
export class A2UIButton extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #FFD93D;
      color: #1E3A5F;
      border: none;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: all 150ms ease;
    }
    :host(:hover) {
      background: #FFE566;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    :host([data-filter-button="true"]) {
      padding: 4px 12px;
      font-size: 14px;
      border-radius: 9999px;
      background: #F3F4F6;
      color: #374151;
      border: 1px solid #D1D5DB;
      font-weight: 400;
    }
    :host([data-filter-button="true"]:hover) {
      background: #FFD93D;
      color: #1E3A5F;
      border-color: #FFD93D;
      box-shadow: 0 2px 4px -2px rgb(0 0 0 / 0.1);
    }
    :host([data-filter-button="true"][data-selected="true"]) {
      background: #FFD93D;
      color: #1E3A5F;
      border-color: #FFD93D;
      font-weight: 500;
    }
    /* Ticket item button - full width, transparent */
    :host([data-ticket-button="true"]) {
      display: block;
      width: 100%;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 0;
    }
    :host([data-ticket-button="true"]:hover) {
      background: transparent;
      box-shadow: none;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-textfield')
export class A2UITextField extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    :host([data-search-field="true"]) {
      flex: 0 0 auto;
      width: 350px;
      margin-right: 16px;
    }
    ::slotted(input),
    ::slotted(textarea) {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      font-family: inherit;
      font-size: 16px;
    }
    ::slotted(input:focus),
    ::slotted(textarea:focus) {
      outline: none;
      border-color: #FFD93D;
      box-shadow: 0 0 0 3px rgba(255, 217, 61, 0.2);
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-column')
export class A2UIColumn extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    :host([data-alignment="center"]) {
      align-items: center;
    }
    :host([data-app-layout="true"]) {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 48px;
      min-height: 100vh;
      box-sizing: border-box;
    }
    :host([data-tickets-list="true"]) {
      gap: 12px;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-row')
export class A2UIRow extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      gap: 16px;
      align-items: center;
    }
    :host([data-search-row="true"]) {
      gap: 32px;
    }
    :host([data-search-row="true"]) ::slotted(a2ui-textfield) {
      flex: 1;
      max-width: 400px;
    }
    :host([data-filter-row="true"]) {
      gap: 8px;
      flex-wrap: wrap;
    }
    :host([data-meta-row="true"]) {
      gap: 12px;
    }
    :host([data-ticket-row="true"]) {
      width: 100%;
      flex: 1;
    }
    :host([data-distribution="spaceBetween"]) {
      justify-content: space-between;
    }
    :host([data-distribution="center"]) {
      justify-content: center;
    }
    :host([data-distribution="end"]) {
      justify-content: flex-end;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-card')
export class A2UICard extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
      transition: all 200ms ease;
    }
    :host(:hover) {
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    /* Ticket list item card - full width row style */
    :host([data-ticket-card="true"]) {
      width: 100%;
      padding: 16px 20px;
      border-radius: 0;
      background: white;
      border: none;
      border-left: 3px solid transparent;
      cursor: pointer;
      box-sizing: border-box;
      box-shadow: none;
    }
    :host([data-ticket-card="true"]:hover) {
      background: #FEFCE8;
      border-left-color: #FFD93D;
      box-shadow: none;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-list')
export class A2UIList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      gap: 12px;
    }
    :host([data-direction="vertical"]) {
      flex-direction: column;
    }
    :host([data-direction="horizontal"]) {
      flex-direction: row;
      flex-wrap: wrap;
    }
    :host([data-tickets="true"]) {
      gap: 0;
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 0;
      overflow: hidden;
    }
    :host([data-tickets="true"]) ::slotted(*) {
      border-bottom: 1px solid #F3F4F6;
    }
    :host([data-tickets="true"]) ::slotted(*:last-child) {
      border-bottom: none;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-icon')
export class A2UIIcon extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-divider')
export class A2UIDivider extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 1px;
      background: #E5E7EB;
      margin: 16px 0;
    }
  `;

  render() {
    return html``;
  }
}

@customElement('a2ui-modal')
export class A2UIModal extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  render() {
    return html`
      <slot name="entry"></slot>
      <slot name="content"></slot>
    `;
  }
}

@customElement('a2ui-checkbox')
export class A2UICheckBox extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
    }
    label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #FFD93D;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-multiselect')
export class A2UIMultiSelect extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }
    .multiselect-label {
      font-weight: 500;
      margin-bottom: 8px;
      color: #374151;
    }
    .multiselect-dropdown {
      position: relative;
    }
    .multiselect-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 10px 14px;
      background: #F9FAFB;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
      transition: all 0.2s;
    }
    .multiselect-trigger:hover {
      border-color: #FFD93D;
    }
    .multiselect-trigger:focus {
      outline: none;
      border-color: #FFD93D;
      box-shadow: 0 0 0 3px rgba(255, 217, 61, 0.2);
    }
    .arrow {
      font-size: 10px;
      color: #6B7280;
    }
    .multiselect-options {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      max-height: 240px;
      overflow-y: auto;
      background: white;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      margin-top: 4px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 100;
    }
    .multiselect-dropdown:focus-within .multiselect-options,
    .multiselect-dropdown:hover .multiselect-options {
      display: block;
    }
    .multiselect-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .multiselect-option:hover {
      background: #FEF9C3;
    }
    .multiselect-option.selected {
      background: #FEF3C7;
    }
    .multiselect-option input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #FFD93D;
      pointer-events: none;
    }
    .color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .option-name {
      flex: 1;
      font-size: 14px;
      color: #374151;
    }
    .no-options {
      padding: 12px 14px;
      color: #9CA3AF;
      font-size: 14px;
      text-align: center;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'a2ui-surface': A2UISurface;
  }
}
