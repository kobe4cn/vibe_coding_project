/**
 * A2UI Renderer - Lit-based rendering for A2UI components
 * Optimized for React hybrid architecture
 */
import { LitElement, html, css, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Component, BoundValue, Action, Children, ExplicitChildren } from '../types';
import { DataModel } from './data-model';

/**
 * A2UI Surface Element - Core renderer
 */
@customElement('a2ui-surface')
export class A2UISurface extends LitElement {
  @property({ type: String }) surfaceId = 'main';
  @state() private components: Map<string, Component> = new Map();
  @state() private rootId: string | null = null;
  @state() private dataVersion = 0; // Increment to trigger re-render on data changes

  private _dataModel: DataModel = new DataModel();
  private actionHandler: ((action: Action, sourceId: string, contextPath?: string) => void) | null = null;
  private unsubscribeDataModel: (() => void) | null = null;

  // Getter/setter for dataModel to handle subscription when externally set
  get dataModel(): DataModel {
    return this._dataModel;
  }

  set dataModel(value: DataModel) {
    // Unsubscribe from old dataModel
    if (this.unsubscribeDataModel) {
      this.unsubscribeDataModel();
    }
    this._dataModel = value;
    // Subscribe to new dataModel
    this.unsubscribeDataModel = this._dataModel.subscribe(() => {
      this.dataVersion++;
    });
  }

  static styles = css`
    :host {
      display: block;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    // Subscribe to DataModel changes to trigger re-renders (for default dataModel)
    if (!this.unsubscribeDataModel) {
      this.unsubscribeDataModel = this._dataModel.subscribe(() => {
        this.dataVersion++;
      });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.unsubscribeDataModel) {
      this.unsubscribeDataModel();
      this.unsubscribeDataModel = null;
    }
  }

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
      case 'CheckBox':
        return this.renderCheckBox(comp.id, props, contextPath);
      case 'ColorSwatch':
        return this.renderColorSwatch(comp.id, props, contextPath);
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
    const width = props.width as string | undefined;

    return html`
      <a2ui-text id=${id} data-usage-hint=${usageHint || nothing} style=${width ? `width: ${width}; flex-shrink: 0;` : nothing}>${text}</a2ui-text>
    `;
  }

  private renderButton(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const childId = props.child as string;
    const action = props.action as Action;
    const variant = props.variant as string | undefined;

    // Check if the child component has content - hide button if empty
    const childContent = this.getChildTextContent(childId, contextPath);
    const isHidden = !childContent || childContent.trim() === '';

    // Check if button is selected (for filter buttons)
    const selectedPath = `/app/tickets/filters/${id}/selected`;
    const selectedValue = this.dataModel.get(selectedPath);
    // Handle both string "true" and boolean true
    const isSelected = selectedValue === 'true' || selectedValue === true;

    // Check if pagination button is enabled
    let isDisabled = false;
    if (id === 'prev-page-btn') {
      const prevEnabled = this.dataModel.get('/app/tickets/pagination/prevEnabled');
      isDisabled = prevEnabled !== 'true';
    } else if (id === 'next-page-btn') {
      const nextEnabled = this.dataModel.get('/app/tickets/pagination/nextEnabled');
      isDisabled = nextEnabled !== 'true';
    }

    const handleClick = (e: Event) => {
      if (isHidden || isDisabled) {
        e.stopPropagation();
        return;
      }
      if (action) {
        this.handleAction(action, id, contextPath);
      }
    };

    return html`
      <a2ui-button
        id=${id}
        data-variant=${variant || nothing}
        data-hidden=${isHidden || nothing}
        data-selected=${isSelected ? 'true' : nothing}
        data-disabled=${isDisabled ? 'true' : nothing}
        @click=${handleClick}
      >
        ${this.renderChildById(childId, contextPath)}
      </a2ui-button>
    `;
  }

  private getChildTextContent(childId: string, contextPath?: string): string {
    const child = this.components.get(childId);
    if (!child) return '';

    const [componentType, componentProps] = Object.entries(child.component)[0] || [];
    if (componentType === 'Text') {
      const props = componentProps as Record<string, unknown>;
      const text = this.resolveValue(props.text as BoundValue, contextPath);
      return String(text ?? '');
    }
    return childId; // Return childId as fallback (non-empty)
  }

  private renderTextField(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const label = this.resolveValue(props.label as BoundValue, contextPath) ?? '';
    const text = this.resolveValue(props.text as BoundValue, contextPath) ?? '';
    const textFieldType = props.textFieldType as string | undefined;

    const textProp = props.text as BoundValue;
    const textPath = textProp && 'path' in textProp ? textProp.path : null;

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (textPath) {
        this.dataModel.set(textPath, target.value);
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
      <a2ui-textfield id=${id}>
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

    return html`
      <a2ui-column
        id=${id}
        data-alignment=${alignment || nothing}
        data-distribution=${distribution || nothing}
      >
        ${children}
      </a2ui-column>
    `;
  }

  private renderRow(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const children = this.renderChildren(props.children as Children, contextPath);
    const alignment = props.alignment as string | undefined;
    const distribution = props.distribution as string | undefined;

    return html`
      <a2ui-row
        id=${id}
        data-alignment=${alignment || nothing}
        data-distribution=${distribution || nothing}
      >
        ${children}
      </a2ui-row>
    `;
  }

  private renderCard(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const childId = props.child as string;

    return html`
      <a2ui-card id=${id}>
        ${this.renderChildById(childId, contextPath)}
      </a2ui-card>
    `;
  }

  private renderList(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const children = props.children as Children;
    const direction = props.direction as string || 'vertical';

    let content: unknown;

    if ('template' in children) {
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
      content = this.renderChildren(children, contextPath);
    }

    return html`
      <a2ui-list id=${id} data-direction=${direction}>
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

  private renderColorSwatch(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const color = this.resolveValue(props.color as BoundValue, contextPath) ?? '#6B7280';
    const width = props.width as string | undefined;
    const style = width
      ? `--swatch-color: ${color}; width: ${width}; display: flex; justify-content: center; flex-shrink: 0;`
      : `--swatch-color: ${color}`;
    return html`<a2ui-color-swatch id=${id} style=${style}></a2ui-color-swatch>`;
  }

  private renderCheckBox(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const label = this.resolveValue(props.label as BoundValue, contextPath) ?? '';
    const value = this.resolveValue(props.value as BoundValue, contextPath) ?? false;

    // Get value binding path for two-way binding
    const valueProp = props.value as BoundValue;
    const valuePath = valueProp && 'path' in valueProp ? valueProp.path : null;
    const action = props.action as Action | undefined;

    const handleChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      // Update DataModel if path is bound
      if (valuePath) {
        this.dataModel.set(valuePath, target.checked);
      }
      // Trigger action if defined
      if (action) {
        this.handleAction(action, id, contextPath);
      }
    };

    return html`
      <a2ui-checkbox id=${id}>
        <label>
          <input
            type="checkbox"
            .checked=${Boolean(value)}
            @change=${handleChange}
          />
          ${label}
        </label>
      </a2ui-checkbox>
    `;
  }

  private renderChildren(children: Children | undefined, contextPath?: string): unknown {
    if (!children) return nothing;

    if ('explicitList' in children) {
      return (children as ExplicitChildren).explicitList.map(childId =>
        this.renderChildById(childId, contextPath)
      );
    }

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

// Custom elements for styling
@customElement('a2ui-text')
export class A2UIText extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host([data-usage-hint="h1"]) {
      display: block;
      font-size: 36px;
      font-weight: 700;
      color: #1E3A5F;
      margin-bottom: 16px;
      white-space: normal;
    }
    :host([data-usage-hint="h2"]) {
      display: block;
      font-size: 24px;
      font-weight: 600;
      color: #1E3A5F;
      margin-bottom: 12px;
      white-space: normal;
    }
    :host([data-usage-hint="h3"]) {
      display: block;
      font-size: 18px;
      font-weight: 600;
      color: #1E3A5F;
      margin-bottom: 4px;
      white-space: normal;
    }
    :host([data-usage-hint="label"]) {
      font-weight: 500;
      color: #374151;
    }
    :host([data-usage-hint="caption"]) {
      font-size: 14px;
      color: #6B7280;
    }
  `;
  render() { return html`<slot></slot>`; }
}

@customElement('a2ui-button')
export class A2UIButton extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: #FFD93D;
      color: #1E3A5F;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms ease;
    }
    :host(:hover) {
      background: #FFE566;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    :host([data-variant="secondary"]) {
      background: #F3F4F6;
      color: #374151;
    }
    :host([data-variant="secondary"]:hover) {
      background: #E5E7EB;
    }
    :host([data-variant="ghost"]) {
      background: transparent;
      color: #1E3A5F;
    }
    :host([data-variant="ghost"]:hover) {
      background: rgba(255, 217, 61, 0.1);
    }
    :host([data-variant="action"]) {
      background: #2563EB;
      color: white;
    }
    :host([data-variant="action"]:hover) {
      background: #1D4ED8;
    }
    :host([data-variant="danger"]) {
      background: #DC2626;
      color: white;
    }
    :host([data-variant="danger"]:hover) {
      background: #B91C1C;
    }
    :host([data-selected="true"]) {
      background: #FFD93D;
      color: #1E3A5F;
    }
    :host([data-variant="secondary"][data-selected="true"]) {
      background: #FFD93D;
      color: #1E3A5F;
    }
    :host([data-disabled="true"]) {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
    :host([data-hidden="true"]) {
      display: none;
    }
  `;
  render() { return html`<slot></slot>`; }
}

@customElement('a2ui-textfield')
export class A2UITextField extends LitElement {
  static styles = css`
    :host { display: block; }
    ::slotted(input),
    ::slotted(textarea) {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      font-family: inherit;
      font-size: 16px;
      box-sizing: border-box;
    }
    ::slotted(input:focus),
    ::slotted(textarea:focus) {
      outline: none;
      border-color: #FFD93D;
      box-shadow: 0 0 0 3px rgba(255, 217, 61, 0.2);
    }
  `;
  render() { return html`<slot></slot>`; }
}

@customElement('a2ui-column')
export class A2UIColumn extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    :host([data-alignment="center"]) { align-items: center; }
    :host([data-alignment="start"]) { align-items: flex-start; }
    :host([data-alignment="end"]) { align-items: flex-end; }
    :host([data-distribution="spaceBetween"]) { justify-content: space-between; }
  `;
  render() { return html`<slot></slot>`; }
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
    :host([data-alignment="start"]) { align-items: flex-start; }
    :host([data-alignment="end"]) { align-items: flex-end; }
    :host([data-distribution="spaceBetween"]) { justify-content: space-between; }
    :host([data-distribution="center"]) { justify-content: center; }
    :host([data-distribution="end"]) { justify-content: flex-end; }
  `;
  render() { return html`<slot></slot>`; }
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
  `;
  render() { return html`<slot></slot>`; }
}

@customElement('a2ui-list')
export class A2UIList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      gap: 12px;
    }
    :host([data-direction="vertical"]) { flex-direction: column; }
    :host([data-direction="horizontal"]) { flex-direction: row; flex-wrap: wrap; }
  `;
  render() { return html`<slot></slot>`; }
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
  render() { return html`<slot></slot>`; }
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
  render() { return html``; }
}

@customElement('a2ui-color-swatch')
export class A2UIColorSwatch extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background-color: var(--swatch-color, #6B7280);
      border: 2px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
  `;
  render() { return html``; }
}

@customElement('a2ui-checkbox')
export class A2UICheckBox extends LitElement {
  static styles = css`
    :host { display: inline-flex; align-items: center; }
    label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    input[type="checkbox"] { width: 18px; height: 18px; accent-color: #FFD93D; }
  `;
  render() { return html`<slot></slot>`; }
}

declare global {
  interface HTMLElementTagNameMap {
    'a2ui-surface': A2UISurface;
  }
}
