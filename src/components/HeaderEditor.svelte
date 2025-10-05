<script>
  import { onMount } from 'svelte'
  
  export let headerText = ''
  export let onContentChange = () => {}
  export let onSave = () => {}
  
  let editorElement = null
  
  // Handle input changes
  const handleInput = (event) => {
    headerText = event.target.innerHTML
    onContentChange(event.target.innerHTML)
  }
  
  const handleBlur = (event) => {
    onSave(event.target.innerHTML)
  }
  
  // Apply formatting
  const applyFormatting = (command, value = null) => {
    if (editorElement) {
      editorElement.focus()
      
      if (command === 'fontSize') {
        // Handle font size with CSS
        document.execCommand('fontSize', false, '7') // Use a dummy font size
        // Find the font tag and replace with span with proper style
        const fontTags = editorElement.querySelectorAll('font[size="7"]')
        fontTags.forEach(font => {
          const span = document.createElement('span')
          span.style.fontSize = value
          span.innerHTML = font.innerHTML
          font.parentNode.replaceChild(span, font)
        })
      } else {
        document.execCommand(command, false, value)
      }
      
      handleInput({ target: { innerHTML: editorElement.innerHTML } })
      
      // Make images resizable after any change
      makeImagesResizable()
    }
  }
  
  // Handle logo upload
  const handleLogoUpload = async (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageData = e.target.result
        const imgHtml = `<img src="${imageData}" alt="Logo" class="floating-resizable-image" style="height: 60px; width: auto; margin: 5px; float: left; cursor: move; border: 2px dashed #ccc; border-radius: 4px; user-select: none;">`
        
        if (editorElement) {
          editorElement.focus()
          document.execCommand('insertHTML', false, imgHtml)
          handleInput({ target: { innerHTML: editorElement.innerHTML } })
          
          // Make the newly inserted image resizable
          setTimeout(() => {
            makeImagesResizable()
          }, 100)
        }
      }
      reader.readAsDataURL(file)
    }
  }
  
  // Remove all images
  const removeAllImages = () => {
    if (editorElement) {
      const content = editorElement.innerHTML
      const contentWithoutImages = content.replace(/<img[^>]*>/gi, '')
      editorElement.innerHTML = contentWithoutImages
      handleInput({ target: { innerHTML: editorElement.innerHTML } })
    }
  }
  
  // Clear all content
  const clearContent = () => {
    if (editorElement) {
      editorElement.innerHTML = ''
      handleInput({ target: { innerHTML: editorElement.innerHTML } })
    }
  }
  
  // Set content programmatically
  export function setContent(content) {
    headerText = content
    if (editorElement) {
      editorElement.innerHTML = content
    }
  }
  
  // Get content
  export function getContent() {
    return headerText
  }
  
  // Make images resizable and draggable
  const makeImagesResizable = () => {
    if (editorElement) {
      const images = editorElement.querySelectorAll('img')
      images.forEach(img => {
        // Add resizable class if not already present
        if (!img.classList.contains('floating-resizable-image')) {
          img.classList.add('floating-resizable-image')
          img.style.float = 'left'
          img.style.cursor = 'move'
          img.style.border = '2px dashed #ccc'
          img.style.borderRadius = '4px'
          img.style.userSelect = 'none'
        }
        
        // Make draggable
        img.draggable = true
        
        // Add resize handles
        if (!img.parentNode.querySelector('.resize-handle')) {
          const resizeHandle = document.createElement('div')
          resizeHandle.className = 'resize-handle'
          resizeHandle.style.cssText = `
            position: absolute;
            bottom: -5px;
            right: -5px;
            width: 10px;
            height: 10px;
            background: #007bff;
            border: 1px solid #fff;
            cursor: se-resize;
            border-radius: 50%;
          `
          
          // Wrap image in a container
          const container = document.createElement('div')
          container.style.cssText = `
            position: relative;
            display: inline-block;
            margin: 5px;
          `
          img.parentNode.insertBefore(container, img)
          container.appendChild(img)
          container.appendChild(resizeHandle)
          
          // Add resize functionality
          let isResizing = false
          let startX, startY, startWidth, startHeight
          
          resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true
            startX = e.clientX
            startY = e.clientY
            startWidth = img.offsetWidth
            startHeight = img.offsetHeight
            
            e.preventDefault()
            e.stopPropagation()
          })
          
          document.addEventListener('mousemove', (e) => {
            if (!isResizing) return
            
            const newWidth = Math.max(20, startWidth + (e.clientX - startX))
            const newHeight = Math.max(20, startHeight + (e.clientY - startY))
            
            img.style.width = newWidth + 'px'
            img.style.height = newHeight + 'px'
            img.style.maxWidth = 'none'
            img.style.maxHeight = 'none'
            
            e.preventDefault()
          })
          
          document.addEventListener('mouseup', () => {
            isResizing = false
            handleInput({ target: { innerHTML: editorElement.innerHTML } })
          })
        }
      })
    }
  }
  
  // Initialize default content if empty
  onMount(() => {
    if (!headerText || headerText.trim() === '') {
      const defaultContent = `
        <h5 style="font-weight: bold; margin: 10px 0; text-align: center;">Dr. [Your Name]</h5>
        <p style="font-weight: 600; margin: 5px 0; text-align: center;">Medical Practice</p>
        <p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">City, Country</p>
        <p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">Tel: +1 (555) 123-4567 | Email: doctor@example.com</p>
        <hr style="margin: 10px 0; border: 1px solid #ccc;">
        <p style="font-weight: bold; margin: 5px 0; text-align: center;">PRESCRIPTION</p>
      `
      headerText = defaultContent
      if (editorElement) {
        editorElement.innerHTML = defaultContent
      }
    }
    
    // Make existing images resizable
    setTimeout(() => {
      makeImagesResizable()
    }, 100)
  })
</script>

<div class="header-editor-container">
  <!-- Logo Upload Section -->
  <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
    <div class="flex items-center justify-between mb-3">
      <label class="block text-sm font-medium text-blue-700">
        <i class="fas fa-image mr-2"></i>Logo & Content Management
      </label>
      <div class="flex space-x-2">
        <button 
          type="button"
          on:click={removeAllImages}
          class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
          title="Remove all images"
        >
          <i class="fas fa-trash mr-1"></i>Remove Images
        </button>
        <button 
          type="button"
          on:click={clearContent}
          class="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
          title="Clear all content"
        >
          <i class="fas fa-eraser mr-1"></i>Clear All
        </button>
      </div>
    </div>
    
    <div class="flex items-center space-x-3">
      <input 
        type="file" 
        accept="image/*"
        on:change={handleLogoUpload}
        class="text-sm text-blue-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-500 file:text-white hover:file:bg-blue-600"
      />
      <span class="text-xs text-gray-600">
        <i class="fas fa-info-circle mr-1"></i>
        Upload logo images to insert into your header
      </span>
    </div>
  </div>
  
  <!-- Formatting Toolbar -->
  <div class="mb-3 p-3 bg-gray-100 rounded-lg border">
    <div class="flex items-center space-x-2 flex-wrap">
      <span class="text-sm font-medium text-gray-700">Formatting:</span>
      
      <!-- Text Formatting -->
      <button 
        type="button"
        on:click={() => applyFormatting('bold')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors font-bold"
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button 
        type="button"
        on:click={() => applyFormatting('italic')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors italic"
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button 
        type="button"
        on:click={() => applyFormatting('underline')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Underline (Ctrl+U)"
        style="text-decoration: underline;"
      >
        U
      </button>
      
      <div class="border-l border-gray-300 mx-2 h-6"></div>
      
      <!-- Font Size -->
      <select 
        on:change={(e) => applyFormatting('fontSize', e.target.value)}
        class="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm border-0 focus:outline-none focus:ring-2 focus:ring-teal-500"
        title="Font Size"
      >
        <option value="">Font Size</option>
        <option value="8px">8px</option>
        <option value="10px">10px</option>
        <option value="12px">12px</option>
        <option value="14px">14px</option>
        <option value="16px">16px</option>
        <option value="18px">18px</option>
        <option value="20px">20px</option>
        <option value="24px">24px</option>
        <option value="28px">28px</option>
        <option value="32px">32px</option>
        <option value="36px">36px</option>
      </select>
      
      <div class="border-l border-gray-300 mx-2 h-6"></div>
      
      <!-- Alignment -->
      <button 
        type="button"
        on:click={() => applyFormatting('justifyLeft')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Align Left"
      >
        <i class="fas fa-align-left"></i>
      </button>
      <button 
        type="button"
        on:click={() => applyFormatting('justifyCenter')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Center Text"
      >
        <i class="fas fa-align-center"></i>
      </button>
      <button 
        type="button"
        on:click={() => applyFormatting('justifyRight')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Align Right"
      >
        <i class="fas fa-align-right"></i>
      </button>
      
      <div class="border-l border-gray-300 mx-2 h-6"></div>
      
      <!-- Lists -->
      <button 
        type="button"
        on:click={() => applyFormatting('insertUnorderedList')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Bullet List"
      >
        <i class="fas fa-list-ul"></i>
      </button>
      <button 
        type="button"
        on:click={() => applyFormatting('insertOrderedList')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Numbered List"
      >
        <i class="fas fa-list-ol"></i>
      </button>
      
      <div class="border-l border-gray-300 mx-2 h-6"></div>
      
      <!-- Other -->
      <button 
        type="button"
        on:click={() => applyFormatting('removeFormat')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Remove Formatting"
      >
        <i class="fas fa-remove-format"></i>
      </button>
    </div>
    
    <div class="mt-2 text-xs text-gray-600">
      <i class="fas fa-info-circle mr-1"></i>
      Select text first, then click formatting buttons. All changes save automatically.
    </div>
  </div>
  
  <!-- Rich Text Editor -->
  <div class="editor-wrapper">
    <div 
      bind:this={editorElement}
      class="rich-text-editor border rounded p-3 bg-white min-h-[200px] focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500"
      contenteditable="true"
      bind:innerHTML={headerText}
      on:input={handleInput}
      on:blur={handleBlur}
    >
    </div>
  </div>
  
  <!-- Help Text -->
  <div class="mt-3 p-3 bg-gray-50 rounded-lg">
    <p class="text-xs text-gray-600 mb-2">
      <i class="fas fa-lightbulb mr-1"></i>
      <strong>Rich Text Editor Features:</strong>
    </p>
    <ul class="text-xs text-gray-500 space-y-1">
      <li>• <strong>Text Formatting:</strong> Bold, italic, underline, font size, alignment</li>
      <li>• <strong>Lists:</strong> Bulleted and numbered lists</li>
      <li>• <strong>Images:</strong> Upload, drag to reposition, resize with corner handle</li>
      <li>• <strong>Auto-Save:</strong> Changes saved automatically</li>
      <li>• <strong>Keyboard Shortcuts:</strong> Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline)</li>
      <li>• <strong>Image Controls:</strong> Drag to move, use blue handle to resize</li>
    </ul>
  </div>
</div>

<style>
  .header-editor-container {
    @apply w-full;
  }
  
  .editor-wrapper {
    @apply border border-gray-300 rounded-lg overflow-hidden;
  }
  
  /* Rich text editor styling */
  .rich-text-editor {
    @apply outline-none;
    line-height: 1.6;
  }
  
  .rich-text-editor:focus {
    @apply outline-none;
  }
  
  /* Ensure images in editor are properly styled */
  .rich-text-editor img {
    margin: 5px !important;
    vertical-align: middle !important;
    border: 2px dashed #ccc !important;
    border-radius: 4px !important;
    display: inline-block;
    user-select: none;
    cursor: move;
  }
  
  .rich-text-editor .floating-resizable-image {
    float: left !important;
    cursor: move !important;
    border: 2px dashed #ccc !important;
    border-radius: 4px !important;
    user-select: none !important;
  }
  
  .rich-text-editor .resize-handle {
    position: absolute;
    bottom: -5px;
    right: -5px;
    width: 10px;
    height: 10px;
    background: #007bff;
    border: 1px solid #fff;
    cursor: se-resize;
    border-radius: 50%;
    z-index: 10;
  }
  
  /* Default content styling */
  .rich-text-editor h5 {
    font-weight: bold;
    margin: 10px 0;
    text-align: center;
  }
  
  .rich-text-editor p {
    margin: 5px 0;
    text-align: center;
  }
  
  .rich-text-editor hr {
    margin: 10px 0;
    border: 1px solid #ccc;
  }
</style>